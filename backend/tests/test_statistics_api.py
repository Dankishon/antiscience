from __future__ import annotations

import sys
import unittest
from pathlib import Path

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


STATISTICS_PROFILES: list[dict[str, int]] = [
    {"hs": 4, "d": 1, "hy": 4, "pd": 3, "mf_f": 2, "mf_m": 1, "pa": 2, "pt": 1, "sc": 0, "ma": 1},
    {"hs": 3, "d": 1, "hy": 4, "pd": 4, "mf_f": 2, "mf_m": 1, "pa": 2, "pt": 1, "sc": 1, "ma": 1},
    {"hs": 4, "d": 0, "hy": 3, "pd": 3, "mf_f": 1, "mf_m": 2, "pa": 1, "pt": 2, "sc": 0, "ma": 2},
    {"hs": 0, "d": 4, "hy": 1, "pd": 1, "mf_f": 2, "mf_m": 3, "pa": 3, "pt": 4, "sc": 4, "ma": 4},
    {"hs": 1, "d": 3, "hy": 1, "pd": 0, "mf_f": 3, "mf_m": 2, "pa": 4, "pt": 3, "sc": 4, "ma": 3},
    {"hs": 0, "d": 4, "hy": 0, "pd": 1, "mf_f": 3, "mf_m": 3, "pa": 4, "pt": 4, "sc": 3, "ma": 4},
]


class StatisticsApiTests(unittest.TestCase):
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

    def _seed_profiles(self, profiles: list[dict[str, int]]) -> None:
        for overrides in profiles:
            self._complete_questionnaire(scale_overrides=overrides)

    def test_statistics_overview_returns_sample_norms_and_external_z_scores(self) -> None:
        user = self._register("statistics_overview_admin")
        self._complete_questionnaire(
            scale_overrides={"hs": 4, "d": 0, "hy": 1, "pd": 1, "mf_f": 2, "mf_m": 2, "pa": 1, "pt": 1, "sc": 0, "ma": 2}
        )
        second_session_id, _ = self._complete_questionnaire(
            scale_overrides={"hs": 0, "d": 4, "hy": 3, "pd": 2, "mf_f": 1, "mf_m": 1, "pa": 2, "pt": 3, "sc": 4, "ma": 1}
        )
        self._promote_current_user_to_admin(user["id"])

        response = self.client.get("/api/v1/admin/analytics/statistics")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        self.assertEqual(payload["overview"]["respondents_count"], 2)
        self.assertFalse(payload["overview"]["insufficient_data"])

        hs_scale = next(item for item in payload["overview"]["scales"] if item["scale_code"] == "hs")
        self.assertAlmostEqual(hs_scale["sample_mean_raw"], 6.0, places=4)
        self.assertAlmostEqual(hs_scale["sample_standard_deviation_raw"], 6.0, places=4)
        self.assertEqual(hs_scale["min_raw"], 0.0)
        self.assertEqual(hs_scale["max_raw"], 12.0)
        self.assertEqual(hs_scale["respondents_count"], 2)

        respondent = next(item for item in payload["overview"]["respondents"] if item["session_id"] == second_session_id)
        self.assertEqual(respondent["raw_scores_by_scale"]["hs"], 0)
        self.assertAlmostEqual(respondent["external_z_scores_by_scale"]["hs"], -1.0, places=4)
        self.assertAlmostEqual(respondent["external_z_scores_by_scale"]["d"], 1.0, places=4)

    def test_statistics_endpoint_returns_reliability_factor_and_cluster_sections(self) -> None:
        user = self._register("statistics_full_admin")
        self._seed_profiles(STATISTICS_PROFILES)
        self._promote_current_user_to_admin(user["id"])

        response = self.client.get("/api/v1/admin/analytics/statistics")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        self.assertEqual(len(payload["reliability"]["scales"]), 10)
        self.assertEqual(len(payload["reliability"]["items"]), 30)
        self.assertTrue(any(item["cronbach_alpha"] is not None for item in payload["reliability"]["scales"]))

        self.assertFalse(payload["factor_analysis"]["insufficient_data"])
        self.assertEqual(payload["factor_analysis"]["respondents_count"], len(STATISTICS_PROFILES))
        self.assertGreaterEqual(payload["factor_analysis"]["recommended_components"], 1)
        self.assertGreater(len(payload["factor_analysis"]["components"]), 0)
        self.assertEqual(len(payload["factor_analysis"]["correlation_matrix"]), 10)
        self.assertEqual(len(payload["factor_analysis"]["loadings"]), 10)

        self.assertFalse(payload["clusters"]["insufficient_data"])
        self.assertEqual(payload["clusters"]["respondents_count"], len(STATISTICS_PROFILES))
        self.assertGreaterEqual(payload["clusters"]["cluster_count"], 2)
        self.assertIsNotNone(payload["clusters"]["silhouette_score"])
        self.assertEqual(len(payload["clusters"]["assignments"]), len(STATISTICS_PROFILES))
        self.assertTrue(all(cluster["dominant_flowers"] for cluster in payload["clusters"]["clusters"]))
        self.assertTrue(all(len(cluster["mean_profile"]) == 10 for cluster in payload["clusters"]["clusters"]))

    def test_statistics_export_returns_structured_json_and_csv(self) -> None:
        user = self._register("statistics_export_admin")
        self._seed_profiles(STATISTICS_PROFILES)
        self._promote_current_user_to_admin(user["id"])

        overview_response = self.client.get("/api/v1/admin/analytics/statistics/export?section=overview&format=json")
        self.assertEqual(overview_response.status_code, 200, overview_response.text)
        overview_payload = overview_response.json()
        self.assertEqual(len(overview_payload), 10)
        self.assertIn("sample_mean_raw", overview_payload[0])
        self.assertIn("sample_standard_deviation_raw", overview_payload[0])

        reliability_csv = self.client.get("/api/v1/admin/analytics/statistics/export?section=reliability&format=csv")
        self.assertEqual(reliability_csv.status_code, 200, reliability_csv.text)
        self.assertIn("cronbach_alpha", reliability_csv.text)
        self.assertIn("item_total_correlation", reliability_csv.text)

        factor_payload = self.client.get("/api/v1/admin/analytics/statistics/export?section=factor-analysis&format=json")
        self.assertEqual(factor_payload.status_code, 200, factor_payload.text)
        factor_rows = factor_payload.json()
        self.assertEqual(len(factor_rows), 10)
        self.assertIn("included_in_pca", factor_rows[0])

        clusters_csv = self.client.get("/api/v1/admin/analytics/statistics/export?section=clusters&format=csv")
        self.assertEqual(clusters_csv.status_code, 200, clusters_csv.text)
        self.assertIn("cluster_id", clusters_csv.text)
        self.assertIn("mean_external_z_score", clusters_csv.text)

    def test_statistics_endpoint_returns_honest_empty_states_for_low_n(self) -> None:
        user = self._register("statistics_low_n_admin")
        self._complete_questionnaire(scale_overrides={"hs": 4, "d": 1, "hy": 2, "pd": 2, "mf_f": 2, "mf_m": 1, "pa": 1, "pt": 1, "sc": 0, "ma": 1})
        self._promote_current_user_to_admin(user["id"])

        response = self.client.get("/api/v1/admin/analytics/statistics")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        self.assertTrue(payload["overview"]["insufficient_data"])
        self.assertIn("внешнего нормирования", payload["overview"]["message"])
        self.assertTrue(payload["factor_analysis"]["insufficient_data"])
        self.assertIn("факторного анализа", payload["factor_analysis"]["message"])
        self.assertTrue(payload["clusters"]["insufficient_data"])
        self.assertIn("кластеризации", payload["clusters"]["message"])


if __name__ == "__main__":
    unittest.main()
