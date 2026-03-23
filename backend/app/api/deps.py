from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_session_token
from app.db.session import get_db
from app.models.user import AuthSession, User


def get_current_auth_session(
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=get_settings().cookie_name),
) -> AuthSession:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")

    session_token_hash = hash_session_token(token)
    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.session_token_hash == session_token_hash,
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if not auth_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия недействительна")

    auth_session.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(auth_session)
    return auth_session


def get_current_user(
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
) -> User:
    user = db.scalar(select(User).where(User.id == auth_session.user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    return user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    return current_user
