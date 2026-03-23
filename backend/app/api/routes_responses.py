from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.response import Answer, ComputedResult, ResponseSession, ScaleScore
from app.models.survey import Question, Survey
from app.models.user import User
from app.schemas.response import (
    AnswerBatchRequest,
    CreateResponseRequest,
    ResponseSessionRead,
    ResultRead,
)
from app.services.scoring import compute_result

router = APIRouter(prefix="/responses", tags=["responses"])


def _serialize_session(session: ResponseSession, total_questions: int) -> ResponseSessionRead:
    return ResponseSessionRead(
        id=session.id,
        survey_code=session.survey.code,
        survey_version=session.survey.version,
        status=session.status,
        answered_count=len(session.answers),
        total_questions=total_questions,
        created_at=session.created_at,
        updated_at=session.updated_at,
        submitted_at=session.submitted_at,
    )


def _load_owned_session(db: Session, session_id: str, user_id: str) -> ResponseSession:
    response_session = db.scalar(
        select(ResponseSession)
        .where(ResponseSession.id == session_id, ResponseSession.user_id == user_id)
        .options(
            selectinload(ResponseSession.answers),
            selectinload(ResponseSession.survey),
            selectinload(ResponseSession.computed_result).selectinload(ComputedResult.scale_scores),
        )
    )
    if not response_session:
        raise HTTPException(status_code=404, detail="Response session not found")
    return response_session


@router.post("", response_model=ResponseSessionRead, status_code=status.HTTP_201_CREATED)
def create_response(
    payload: CreateResponseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResponseSessionRead:
    settings = get_settings()
    survey = db.scalar(
        select(Survey).where(
            Survey.code == (payload.survey_code or settings.active_survey_code),
            Survey.version == (payload.survey_version or settings.active_survey_version),
        )
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    response_session = ResponseSession(user_id=current_user.id, survey_id=survey.id, status="in_progress")
    db.add(response_session)
    db.commit()
    db.refresh(response_session)
    response_session = _load_owned_session(db, response_session.id, current_user.id)
    total_questions = db.query(Question).filter(Question.survey_id == survey.id).count()
    return _serialize_session(response_session, total_questions)


@router.put("/{session_id}/answers", response_model=ResponseSessionRead)
def save_answers(
    session_id: str,
    payload: AnswerBatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResponseSessionRead:
    response_session = _load_owned_session(db, session_id, current_user.id)
    if response_session.status == "submitted":
        raise HTTPException(status_code=409, detail="Response session is already submitted")

    questions = {
        question.code: question
        for question in db.scalars(select(Question).where(Question.survey_id == response_session.survey_id)).all()
    }
    existing_answers = {answer.question_code: answer for answer in response_session.answers}

    for item in payload.answers:
        question = questions.get(item.question_code)
        if not question:
            raise HTTPException(status_code=400, detail=f"Unknown question code: {item.question_code}")
        if item.value < question.min_value or item.value > question.max_value:
            raise HTTPException(status_code=400, detail=f"Value is out of range for {item.question_code}")

        stored = existing_answers.get(item.question_code)
        if stored:
            stored.value = item.value
        else:
            db.add(Answer(response_session_id=response_session.id, question_code=item.question_code, value=item.value))

    response_session.updated_at = datetime.now(timezone.utc)
    db.commit()
    refreshed = _load_owned_session(db, response_session.id, current_user.id)
    total_questions = len(questions)
    return _serialize_session(refreshed, total_questions)


@router.post("/{session_id}/submit", response_model=ResultRead)
def submit_response(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResultRead:
    response_session = _load_owned_session(db, session_id, current_user.id)
    if response_session.status == "submitted" and response_session.computed_result:
        payload = response_session.computed_result.result_payload
        return ResultRead(**payload, response_session_id=response_session.id, submitted_at=response_session.submitted_at)

    answers = {answer.question_code: answer.value for answer in response_session.answers}
    try:
        result_payload = compute_result(answers)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.execute(delete(ScaleScore).where(ScaleScore.computed_result_id == select(ComputedResult.id).where(ComputedResult.response_session_id == response_session.id).scalar_subquery()))
    db.execute(delete(ComputedResult).where(ComputedResult.response_session_id == response_session.id))

    computed_result = ComputedResult(
        response_session_id=response_session.id,
        main_flower_code=result_payload["main_flower"]["flower_code"],
        main_flower_title=result_payload["main_flower"]["flower_title"],
        main_flower_symbol=result_payload["main_flower"]["flower_symbol"],
        mean_value=result_payload["mean"],
        standard_deviation=result_payload["standard_deviation"],
        tie_break_strategy=result_payload["tie_break"]["strategy"],
        result_payload=result_payload,
    )
    db.add(computed_result)
    db.flush()

    for row in result_payload["scale_scores"]:
        db.add(
            ScaleScore(
                computed_result_id=computed_result.id,
                scale_code=row["scale_code"],
                flower_code=row["flower_code"],
                flower_title=row["flower_title"],
                flower_symbol=row["flower_symbol"],
                raw_score=row["raw_score"],
                z_score=row["z_score"],
                rank=row["rank"],
            )
        )

    response_session.status = "submitted"
    response_session.submitted_at = datetime.now(timezone.utc)
    response_session.updated_at = response_session.submitted_at
    db.commit()

    refreshed = _load_owned_session(db, response_session.id, current_user.id)
    payload = refreshed.computed_result.result_payload if refreshed.computed_result else result_payload
    return ResultRead(**payload, response_session_id=refreshed.id, submitted_at=refreshed.submitted_at)


@router.get("/{session_id}/result", response_model=ResultRead)
def get_result(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResultRead:
    response_session = _load_owned_session(db, session_id, current_user.id)
    if not response_session.computed_result:
        raise HTTPException(status_code=404, detail="Result is not available yet")

    payload = response_session.computed_result.result_payload
    return ResultRead(**payload, response_session_id=response_session.id, submitted_at=response_session.submitted_at)
