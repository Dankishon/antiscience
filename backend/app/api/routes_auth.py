from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_auth_session, get_current_user
from app.core.config import get_settings
from app.core.security import generate_session_token, hash_password, hash_session_token, verify_password
from app.db.session import get_db
from app.models.user import AuthSession, User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, session_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.cookie_name,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.session_ttl_minutes * 60,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(get_settings().cookie_name, path="/")


def _create_auth_session(db: Session, user: User) -> str:
    settings = get_settings()
    db.flush()
    session_token = generate_session_token()
    auth_session = AuthSession(
        user_id=user.id,
        session_token_hash=hash_session_token(session_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.session_ttl_minutes),
    )
    db.add(auth_session)
    return session_token


def _build_guest_username(db: Session) -> str:
    while True:
        username = f"guest-{secrets.token_hex(4)}"
        if not db.scalar(select(User).where(User.username == username)):
            return username


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Пользователь с таким именем уже существует")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_guest=False,
        role="user",
    )
    db.add(user)
    session_token = _create_auth_session(db, user)
    db.commit()
    db.refresh(user)
    _set_auth_cookie(response, session_token)
    return AuthResponse(user=UserRead.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверное имя пользователя или пароль")

    session_token = _create_auth_session(db, user)
    db.commit()
    _set_auth_cookie(response, session_token)
    return AuthResponse(user=UserRead.model_validate(user))


@router.post("/guest", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def guest_login(response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    username = _build_guest_username(db)
    user = User(
        username=username,
        password_hash=hash_password(secrets.token_urlsafe(24)),
        is_guest=True,
        role="guest",
    )
    db.add(user)
    session_token = _create_auth_session(db, user)
    db.commit()
    db.refresh(user)
    _set_auth_cookie(response, session_token)
    return AuthResponse(user=UserRead.model_validate(user))


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    response: Response,
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    db.delete(auth_session)
    db.commit()
    _clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=AuthResponse)
def me(current_user: User = Depends(get_current_user)) -> AuthResponse:
    return AuthResponse(user=UserRead.model_validate(current_user))
