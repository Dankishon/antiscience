from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_admin import router as admin_router
from app.api.routes_auth import router as auth_router
from app.api.routes_me import router as me_router
from app.api.routes_responses import router as responses_router
from app.api.routes_survey import router as survey_router
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.seed_service import ensure_seed_data

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    with SessionLocal() as session:
        ensure_seed_data(session)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(survey_router, prefix="/api/v1")
app.include_router(responses_router, prefix="/api/v1")
app.include_router(me_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


@app.get("/api/health")
def health() -> dict:
    return {
        "service": "flower-profile-backend",
        "status": "ok",
        "database": "postgresql",
    }


@app.get("/api/v1/health")
def health_v1() -> dict:
    return health()
