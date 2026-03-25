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

from app.api.routes_auth import router as auth_router  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.models.survey import Flower  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.seed_service import ensure_seed_data  # noqa: E402


class BootstrapAdminTests(unittest.TestCase):
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

    def test_test_admin_is_seeded_and_can_login(self) -> None:
        with self.testing_session_local() as db:
            user = db.scalar(select(User).where(User.username == "test_admin"))
            self.assertIsNotNone(user)
            self.assertEqual(user.role, "admin")
            self.assertFalse(user.is_guest)

        response = self.client.post(
            "/api/v1/auth/login",
            json={"username": "test_admin", "password": "admin12345"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["user"]["username"], "test_admin")
        self.assertEqual(payload["user"]["role"], "admin")

    def test_seed_refresh_updates_existing_flower_symbol(self) -> None:
        with self.testing_session_local() as db:
            iris = db.scalar(select(Flower).where(Flower.code == "iris"))
            self.assertIsNotNone(iris)
            iris.symbol = "💠"
            db.commit()

            ensure_seed_data(db)
            db.refresh(iris)
            self.assertEqual(iris.symbol, "🪻")


if __name__ == "__main__":
    unittest.main()
