from __future__ import annotations

import unittest
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_admin import router as admin_router  # noqa: E402
from app.api.routes_auth import router as auth_router  # noqa: E402
from app.api.routes_me import router as me_router  # noqa: E402
from app.api.routes_responses import router as responses_router  # noqa: E402
from app.api.routes_survey import router as survey_router  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.models.response import ComputedResult, ResponseSession, ScaleScore  # noqa: E402
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


class ResultsApiTests(unittest.TestCase):
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
        app.include_router(me_router, prefix="/api/v1")
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

    def _login_guest(self) -> dict:
        response = self.client.post("/api/v1/auth/guest", json={})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["user"]

    def _logout(self) -> None:
        response = self.client.post("/api/v1/auth/logout", json={})
        self.assertEqual(response.status_code, 200, response.text)

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

    def test_submit_persists_result_and_exposes_history(self) -> None:
        self._register("history_user")
        session_id, submit_payload = self._complete_questionnaire(scale_overrides={"hs": 4})

        with self.testing_session_local() as db:
            response_session = db.scalar(select(ResponseSession).where(ResponseSession.id == session_id))
            self.assertIsNotNone(response_session)
            self.assertEqual(response_session.status, "submitted")

            computed_result = db.scalar(
                select(ComputedResult).where(ComputedResult.response_session_id == session_id)
            )
            self.assertIsNotNone(computed_result)
            self.assertEqual(computed_result.main_flower_code, submit_payload["main_flower"]["flower_code"])

            score_count = db.query(ScaleScore).filter(ScaleScore.computed_result_id == computed_result.id).count()
            self.assertEqual(score_count, 10)

        history_response = self.client.get("/api/v1/me/results")
        self.assertEqual(history_response.status_code, 200, history_response.text)
        history_items = history_response.json()
        self.assertEqual(len(history_items), 1)
        result_id = history_items[0]["id"]
        self.assertFalse(history_items[0]["is_guest_session"])
        self.assertEqual(history_items[0]["response_session_id"], session_id)

        detail_response = self.client.get(f"/api/v1/me/results/{result_id}")
        self.assertEqual(detail_response.status_code, 200, detail_response.text)
        detail_payload = detail_response.json()
        self.assertEqual(detail_payload["id"], result_id)
        self.assertEqual(detail_payload["response_session_id"], session_id)
        self.assertEqual(detail_payload["main_flower"]["flower_code"], "lily")
        self.assertEqual(len(detail_payload["scale_scores"]), 10)

        delete_response = self.client.delete(f"/api/v1/me/results/{result_id}")
        self.assertEqual(delete_response.status_code, 200, delete_response.text)
        self.assertEqual(delete_response.json(), {"ok": True})

        with self.testing_session_local() as db:
            self.assertEqual(db.query(ResponseSession).count(), 0)
            self.assertEqual(db.query(ComputedResult).count(), 0)
            self.assertEqual(db.query(ScaleScore).count(), 0)

    def test_guest_result_history_is_available_for_guest_session(self) -> None:
        guest_user = self._login_guest()
        self.assertTrue(guest_user["is_guest"])

        self._complete_questionnaire(scale_overrides={"ma": 4})

        history_response = self.client.get("/api/v1/me/results")
        self.assertEqual(history_response.status_code, 200, history_response.text)
        history_items = history_response.json()
        self.assertEqual(len(history_items), 1)
        self.assertTrue(history_items[0]["is_guest_session"])
        self.assertEqual(history_items[0]["main_flower"]["flower_code"], "sunflower")

    def test_admin_analytics_summary_and_export_use_database_results(self) -> None:
        self._register("person_one")
        self._complete_questionnaire(scale_overrides={"hs": 4})
        self.client.post("/api/v1/responses", json={})
        self._logout()

        self._login_guest()
        self._complete_questionnaire(scale_overrides={"ma": 4})
        self._logout()

        admin_user = self._register("chief_admin")
        with self.testing_session_local() as db:
            user = db.scalar(select(User).where(User.id == admin_user["id"]))
            self.assertIsNotNone(user)
            user.role = "admin"
            db.commit()

        summary_response = self.client.get("/api/v1/admin/analytics/summary")
        self.assertEqual(summary_response.status_code, 200, summary_response.text)
        summary_payload = summary_response.json()
        self.assertEqual(summary_payload["total_attempts"], 3)
        self.assertEqual(summary_payload["completed_tests"], 2)
        self.assertEqual(sum(item["count"] for item in summary_payload["main_flower_distribution"]), 2)
        self.assertTrue(all("flower_code" in item for item in summary_payload["main_flower_distribution"]))
        self.assertTrue(all("flower_title" in item for item in summary_payload["main_flower_distribution"]))
        self.assertTrue(all("count" in item for item in summary_payload["main_flower_distribution"]))
        self.assertEqual(len(summary_payload["average_raw_scores"]), 10)

        export_json_response = self.client.get("/api/v1/admin/analytics/export?format=json")
        self.assertEqual(export_json_response.status_code, 200, export_json_response.text)
        export_json_payload = export_json_response.json()
        self.assertEqual(len(export_json_payload), 20)
        self.assertEqual(export_json_payload[0]["survey_code"], "flower-soul-profile")

        export_csv_response = self.client.get("/api/v1/admin/analytics/export?format=csv")
        self.assertEqual(export_csv_response.status_code, 200, export_csv_response.text)
        self.assertEqual(export_csv_response.headers["content-type"], "text/csv; charset=utf-8")
        self.assertIn("computed_result_id,response_session_id,user_id,username", export_csv_response.text)
        self.assertIn("scale_code,scale_title,raw_score,z_score", export_csv_response.text)


if __name__ == "__main__":
    unittest.main()
