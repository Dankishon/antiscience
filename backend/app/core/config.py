from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "Flower Profile API"
    secret_key: str = "change-me"
    session_ttl_minutes: int = 60 * 24 * 7
    cookie_name: str = "flower_profile_session"
    test_admin_enabled: bool = True
    test_admin_username: str = "test_admin"
    test_admin_password: str = "admin12345"
    postgres_db: str = "flower_profile"
    postgres_user: str = "flower"
    postgres_password: str = "flower"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    database_url: str | None = None
    cors_origins: str = "http://localhost,http://localhost:8080"
    active_survey_code: str = "flower-soul-profile"
    active_survey_version: int = 1
    seeds_dir: str = str(ROOT_DIR / "seeds")

    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url

        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
