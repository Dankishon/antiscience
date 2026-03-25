from __future__ import annotations

import unittest
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_admin import router as admin_router  # noqa: E402
from app.api.routes_auth import router as auth_router  # noqa: E402
from app.api.routes_responses import router as responses_router  # noqa: E402
from app.api.routes_survey import router as survey_router  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.models.response import Answer, ScaleScore  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.scoring import build_catalog  # noqa: E402
from app.services.seed_service import ensure_seed_data  # noqa: E402


def build_answers(*, default_value: int = 0, scale_overrides: dict[str, int] | None = None) -> dict[str, int]:
    _, _, _, questions = build_catalog()
    overrides = scale_overrides or {}
    answers: dict[str, int] = {}
    for question in questions.values():
        answers[question["code"]] = overrides.get(question["scaleCode"], default_value)
    return answers


class AdminAnalyticsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        self.testing_session_local = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )
        Base.metadata.create_all(self.engine)

        with self.testing_session_local() as session:
            ensure_seed_data(session)

        app = FastAPI()
        app.include_router(auth_router, prefix="/api/v1")
        app.include_router(survey_router, prefix="/api/v1")
        app.include_router(responses_router, prefix="/api/v1")
        app.include_router(admin_router, prefix="/api/v1")

        def override_get_db():
            db = self.testing_session_local()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _register(self, username: str, password: str = "strong-pass-123") -> dict:
        response = self.client.post("/api/v1/auth/register", json={"username": username, "password": password})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["user"]

    def _logout(self) -> None:
        response = self.client.post("/api/v1/auth/logout", json={})
        self.assertEqual(response.status_code, 200, response.text)

    def _guest_login(self) -> dict:
        response = self.client.post("/api/v1/auth/guest", json={})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["user"]

    def _complete_questionnaire(self, *, scale_overrides: dict[str, int] | None = None) -> tuple[str, dict]:
        response = self.client.post("/api/v1/responses", json={})
        self.assertEqual(response.status_code, 201, response.text)
        session_id = response.json()["id"]

        answers = build_answers(scale_overrides=scale_overrides)
        save_response = self.client.put(
            f"/api/v1/responses/{session_id}/answers",
            json={
                "answers": [
                    {"question_code": question_code, "value": value}
                    for question_code, value in answers.items()
                ]
            },
        )
        self.assertEqual(save_response.status_code, 200, save_response.text)

        submit_response = self.client.post(f"/api/v1/responses/{session_id}/submit", json={})
        self.assertEqual(submit_response.status_code, 200, submit_response.text)
        return session_id, submit_response.json()

    def _promote_current_user_to_admin(self, user_id: str) -> None:
        with self.testing_session_local() as db:
            user = db.scalar(select(User).where(User.id == user_id))
            self.assertIsNotNone(user)
            user.role = "admin"
            db.commit()

    def test_raw_scores_endpoint_returns_question_level_breakdown(self) -> None:
        user = self._register("analytics_owner")
        session_id, _ = self._complete_questionnaire(scale_overrides={"hs": 4, "d": 2})
        self._promote_current_user_to_admin(user["id"])

        response = self.client.get(f"/api/v1/admin/analytics/respondents/{session_id}/raw-scores")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        self.assertEqual(payload["session_id"], session_id)
        self.assertEqual(payload["user_id"], user["id"])
        self.assertFalse(payload["is_guest"])
        self.assertIsNotNone(payload["main_flower"])
        self.assertIsNotNone(payload["secondary_flower"])
        self.assertIsNotNone(payload["interpretation"])
        self.assertIsNotNone(payload["duration_seconds"])
        self.assertIn("mean", payload)
        self.assertIn("standard_deviation", payload)
        self.assertEqual(len(payload["scales"]), 10)

        hs_scale = next(item for item in payload["scales"] if item["scale_code"] == "hs")
        self.assertEqual(hs_scale["raw_score"], 12)
        self.assertIn("z_score", hs_scale)
        self.assertIn("rank", hs_scale)
        self.assertEqual(len(hs_scale["questions"]), 3)
        self.assertTrue(all(question["answer_value"] == 4 for question in hs_scale["questions"]))
        self.assertTrue(all(question["contribution_to_scale"] == 4 for question in hs_scale["questions"]))
        self.assertEqual(sum(question["contribution_to_scale"] for question in hs_scale["questions"]), hs_scale["raw_score"])

        mean_value = payload["mean"]
        standard_deviation = payload["standard_deviation"]
        for scale in payload["scales"]:
            raw_score = scale["raw_score"]
            expected_z = 0.0 if standard_deviation == 0 else round((raw_score - mean_value) / standard_deviation, 4)
            self.assertAlmostEqual(scale["z_score"], expected_z, places=3)

        with self.testing_session_local() as db:
            stored_answers = db.scalars(select(Answer).where(Answer.response_session_id == session_id)).all()
            self.assertEqual(len(stored_answers), 30)
            self.assertTrue(all(answer.question_id for answer in stored_answers))

    def test_raw_matrix_and_detailed_export_cover_all_respondents(self) -> None:
        admin_user = self._register("matrix_admin")
        first_session_id, _ = self._complete_questionnaire(scale_overrides={"hs": 4, "ma": 1})
        self._logout()

        guest_user = self._guest_login()
        second_session_id, _ = self._complete_questionnaire(scale_overrides={"hs": 1, "ma": 4})
        self._logout()

        self.client.post("/api/v1/auth/login", json={"username": "matrix_admin", "password": "strong-pass-123"})
        self._promote_current_user_to_admin(admin_user["id"])

        raw_matrix_response = self.client.get("/api/v1/admin/analytics/respondents/raw-matrix")
        self.assertEqual(raw_matrix_response.status_code, 200, raw_matrix_response.text)
        raw_matrix = raw_matrix_response.json()

        self.assertEqual(len(raw_matrix["scales"]), 10)
        self.assertEqual(len(raw_matrix["questions"]), 30)
        self.assertEqual(len(raw_matrix["question_stats"]), 30)
        self.assertEqual(len(raw_matrix["respondents"]), 2)
        self.assertEqual({item["session_id"] for item in raw_matrix["respondents"]}, {first_session_id, second_session_id})

        guest_row = next(item for item in raw_matrix["respondents"] if item["user_id"] == guest_user["id"])
        self.assertTrue(guest_row["is_guest"])
        self.assertEqual(guest_row["raw_scores_by_scale"]["ma"], 12)
        self.assertIn("z_scores_by_scale", guest_row)
        self.assertIn("main_flower_title", guest_row)

        filtered_matrix_response = self.client.get("/api/v1/admin/analytics/respondents/raw-matrix?scale_code=hs")
        self.assertEqual(filtered_matrix_response.status_code, 200, filtered_matrix_response.text)
        filtered_matrix = filtered_matrix_response.json()
        self.assertEqual(len(filtered_matrix["questions"]), 3)
        self.assertTrue(all(question["scale_code"] == "hs" for question in filtered_matrix["questions"]))
        self.assertTrue(all("distribution" in item for item in filtered_matrix["question_stats"]))

        export_json_response = self.client.get("/api/v1/admin/analytics/export/detailed?format=json")
        self.assertEqual(export_json_response.status_code, 200, export_json_response.text)
        export_json = export_json_response.json()
        self.assertEqual(len(export_json), 2)
        self.assertIn("q1", export_json[0])
        self.assertIn("q30", export_json[0])
        self.assertIn("scale_lily_raw", export_json[0])
        self.assertIn("scale_sunflower_raw", export_json[0])
        self.assertIn("scale_lily_z", export_json[0])
        self.assertIn("duration_seconds", export_json[0])

        export_csv_response = self.client.get("/api/v1/admin/analytics/export/detailed?format=csv")
        self.assertEqual(export_csv_response.status_code, 200, export_csv_response.text)
        self.assertIn(
            "session_id,user_id,username,respondent_label,is_guest,submitted_at,duration_seconds,main_flower_code,main_flower_title,mean,standard_deviation",
            export_csv_response.text,
        )
        self.assertIn("q1", export_csv_response.text)
        self.assertIn("scale_lily_raw", export_csv_response.text)
        self.assertIn("scale_lily_z", export_csv_response.text)

        with self.testing_session_local() as db:
            total_scale_scores = db.scalars(select(ScaleScore)).all()
            self.assertEqual(len(total_scale_scores), 20)

    def test_question_stats_endpoint_returns_distribution_and_missing_counts(self) -> None:
        admin_user = self._register("questions_admin")
        self._complete_questionnaire(scale_overrides={"hs": 4, "d": 1})
        self._complete_questionnaire(scale_overrides={"hs": 2, "d": 3})
        self._promote_current_user_to_admin(admin_user["id"])

        response = self.client.get("/api/v1/admin/analytics/question-stats?scale_code=hs")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        self.assertEqual(payload["scale_code"], "hs")
        self.assertEqual(payload["respondents_count"], 2)
        self.assertEqual(len(payload["questions"]), 3)
        first_question = payload["questions"][0]
        self.assertEqual(first_question["scale_code"], "hs")
        self.assertEqual(first_question["count"], 2)
        self.assertEqual(first_question["missing_count"], 0)
        self.assertEqual(len(first_question["distribution"]), 5)
        self.assertEqual(sum(bucket["count"] for bucket in first_question["distribution"]), 2)
        self.assertAlmostEqual(first_question["mean_answer"], 3.0, places=3)

    def test_internal_consistency_endpoint_returns_metrics_for_selected_scale(self) -> None:
        admin_user = self._register("consistency_admin")
        self._complete_questionnaire(scale_overrides={"hs": 1})
        self._complete_questionnaire(scale_overrides={"hs": 2})
        self._complete_questionnaire(scale_overrides={"hs": 3})
        self._promote_current_user_to_admin(admin_user["id"])

        response = self.client.get("/api/v1/admin/analytics/internal-consistency?scale_code=hs")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        self.assertEqual(payload["scale_code"], "hs")
        self.assertEqual(payload["questions_count"], 3)
        self.assertEqual(payload["respondents_count"], 3)
        self.assertFalse(payload["insufficient_data"])
        self.assertIsNotNone(payload["cronbach_alpha"])
        self.assertEqual(len(payload["items"]), 3)
        self.assertTrue(all("standard_deviation" in item for item in payload["items"]))
        self.assertTrue(all(item["item_total_correlation"] is not None for item in payload["items"]))
        self.assertTrue(all(item["alpha_if_deleted"] is not None for item in payload["items"]))


if __name__ == "__main__":
    unittest.main()
