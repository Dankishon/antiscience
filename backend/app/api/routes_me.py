from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.response import ComputedResult, ResponseSession
from app.models.user import User
from app.schemas.response import DeleteResultResponse, ResultHistoryItemRead, StoredResultRead
from app.services.results import build_result_history_item, build_stored_result_read

router = APIRouter(prefix="/me", tags=["me"])


def _load_result_session(db: Session, result_id: str, user_id: str) -> ResponseSession:
    response_session = db.scalar(
        select(ResponseSession)
        .join(ComputedResult, ComputedResult.response_session_id == ResponseSession.id)
        .where(
            ResponseSession.user_id == user_id,
            ResponseSession.status == "submitted",
            ComputedResult.id == result_id,
        )
        .options(
            selectinload(ResponseSession.user),
            selectinload(ResponseSession.computed_result),
        )
    )
    if not response_session:
        raise HTTPException(status_code=404, detail="Результат не найден")
    return response_session


@router.get("/results", response_model=list[ResultHistoryItemRead])
def list_my_results(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ResultHistoryItemRead]:
    sessions = db.scalars(
        select(ResponseSession)
        .join(ComputedResult, ComputedResult.response_session_id == ResponseSession.id)
        .where(
            ResponseSession.user_id == current_user.id,
            ResponseSession.status == "submitted",
        )
        .options(
            selectinload(ResponseSession.user),
            selectinload(ResponseSession.computed_result),
        )
        .order_by(ResponseSession.submitted_at.desc().nullslast(), ResponseSession.created_at.desc())
    ).all()

    return [
        build_result_history_item(session.computed_result, session)
        for session in sessions
        if session.computed_result
    ]


@router.get("/results/{result_id}", response_model=StoredResultRead)
def get_my_result(
    result_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StoredResultRead:
    response_session = _load_result_session(db, result_id, current_user.id)
    return build_stored_result_read(response_session)


@router.delete("/results/{result_id}", response_model=DeleteResultResponse)
def delete_my_result(
    result_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DeleteResultResponse:
    response_session = _load_result_session(db, result_id, current_user.id)
    db.delete(response_session)
    db.commit()
    return DeleteResultResponse(ok=True)
