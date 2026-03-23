from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.survey import Flower, Question, Survey
from app.schemas.survey import ActiveSurveyRead, LikertOption, SurveyQuestionRead
from app.services.seed_service import load_question_seed

router = APIRouter(prefix="/survey", tags=["survey"])


@router.get("/active", response_model=ActiveSurveyRead)
def get_active_survey(db: Session = Depends(get_db)) -> ActiveSurveyRead:
    settings = get_settings()
    survey = db.scalar(
        select(Survey).where(
            Survey.code == settings.active_survey_code,
            Survey.version == settings.active_survey_version,
        )
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Active survey is not available")

    questions = db.scalars(
        select(Question).where(Question.survey_id == survey.id).order_by(Question.number.asc())
    ).all()
    flowers = {
        flower.code: flower
        for flower in db.scalars(select(Flower).where(Flower.survey_id == survey.id)).all()
    }
    seed = load_question_seed()

    return ActiveSurveyRead(
        code=survey.code,
        version=survey.version,
        title=survey.title,
        description=survey.description,
        instruction=survey.instruction,
        algorithm_version=survey.algorithm_version,
        question_count=len(questions),
        likert_scale=[LikertOption(**item) for item in seed["survey"]["likertScale"]],
        questions=[
            SurveyQuestionRead(
                code=question.code,
                number=question.number,
                prompt=question.prompt,
                scale_code=question.scale_code,
                flower_code=question.flower_code,
                flower_title=flowers[question.flower_code].title,
                flower_symbol=flowers[question.flower_code].symbol,
                min_value=question.min_value,
                max_value=question.max_value,
            )
            for question in questions
        ],
    )
