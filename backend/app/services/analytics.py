from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.response import Answer, ComputedResult, ResponseSession, ScaleScore
from app.models.survey import Question, Survey, SurveyScale
from app.models.user import User
from app.schemas.analytics import (
    AdminDistributionBucketRead,
    AdminQuestionMetaRead,
    AdminQuestionStatRead,
    AdminQuestionStatsPayloadRead,
    AdminRespondentInterpretationRead,
    AdminRespondentMainFlowerRead,
    AdminRespondentMatrixRowRead,
    AdminRespondentQuestionRead,
    AdminRespondentRawMatrixRead,
    AdminRespondentRawScoresRead,
    AdminRespondentScaleRead,
    AdminScaleMetaRead,
    InternalConsistencyItemRead,
    InternalConsistencyRead,
)
from app.schemas.response import (
    AnalyticsExportRowRead,
    AnalyticsFlowerDistributionRead,
    AnalyticsScaleAverageRead,
    AnalyticsSummaryRead,
)
from app.services.psychometrics import (
    corrected_item_total_correlation,
    cronbach_alpha,
    cronbach_alpha_if_item_deleted,
    mean,
    sample_standard_deviation,
    sample_variance,
)


def _round(value: float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 4)


def _active_survey(db: Session) -> Survey | None:
    settings = get_settings()
    return db.scalar(
        select(Survey)
        .where(
            Survey.code == settings.active_survey_code,
            Survey.version == settings.active_survey_version,
        )
        .options(
            selectinload(Survey.questions),
            selectinload(Survey.survey_scales),
        )
    )


def _submitted_sessions_query() -> Any:
    return (
        select(ResponseSession)
        .where(ResponseSession.status == "submitted")
        .options(
            selectinload(ResponseSession.user),
            selectinload(ResponseSession.answers).selectinload(Answer.question),
            selectinload(ResponseSession.computed_result).selectinload(ComputedResult.scale_scores),
            selectinload(ResponseSession.survey).selectinload(Survey.questions),
            selectinload(ResponseSession.survey).selectinload(Survey.survey_scales),
        )
        .order_by(ResponseSession.submitted_at.desc().nullslast(), ResponseSession.created_at.desc())
    )


def _ordered_scales(survey: Survey | None) -> list[SurveyScale]:
    if not survey:
        return []
    return sorted(survey.survey_scales, key=lambda item: (item.sort_order, item.code))


def _ordered_questions(survey: Survey | None, *, scale_code: str | None = None) -> list[Question]:
    if not survey:
        return []
    items = [question for question in survey.questions if scale_code is None or question.scale_code == scale_code]
    return sorted(items, key=lambda item: (item.sort_order, item.number, item.code))


def _question_lookup(survey: Survey | None) -> dict[str, Question]:
    if not survey:
        return {}
    return {question.code: question for question in survey.questions}


def _scale_lookup(survey: Survey | None) -> dict[str, SurveyScale]:
    if not survey:
        return {}
    return {scale.code: scale for scale in survey.survey_scales}


def _respondent_label(user: User) -> str:
    return f"Гость · {user.username}" if user.is_guest else user.username


def _duration_seconds(response_session: ResponseSession) -> int | None:
    if not response_session.submitted_at:
        return None
    total_seconds = int((response_session.submitted_at - response_session.created_at).total_seconds())
    return max(total_seconds, 0)


def _scale_score_lookup(response_session: ResponseSession) -> dict[str, ScaleScore]:
    if not response_session.computed_result or not response_session.computed_result.scale_scores:
        return {}
    return {
        score.scale_code: score
        for score in response_session.computed_result.scale_scores
    }


def _raw_score_map(
    response_session: ResponseSession,
    *,
    question_by_code: dict[str, Question],
    scale_by_code: dict[str, SurveyScale],
) -> dict[str, int]:
    if response_session.computed_result and response_session.computed_result.scale_scores:
        return {
            score.scale_code: score.raw_score
            for score in response_session.computed_result.scale_scores
        }

    totals = {scale_code: 0 for scale_code in scale_by_code}
    for answer in response_session.answers:
        question = answer.question or question_by_code.get(answer.question_code)
        if not question:
            continue
        totals[question.scale_code] = totals.get(question.scale_code, 0) + answer.value
    return totals


def _build_scale_meta(scale: SurveyScale) -> AdminScaleMetaRead:
    return AdminScaleMetaRead(
        scale_code=scale.code,
        scale_name=scale.title,
        short_code=scale.short_code,
        flower_code=scale.flower_code,
    )


def _build_question_meta(question: Question, *, scale_name: str) -> AdminQuestionMetaRead:
    return AdminQuestionMetaRead(
        question_id=question.id,
        question_code=question.code,
        question_order=question.number,
        question_text=question.prompt,
        scale_code=question.scale_code,
        scale_name=scale_name,
    )


def _build_question_stats(
    sessions: list[ResponseSession],
    *,
    ordered_questions: list[Question],
    scale_by_code: dict[str, SurveyScale],
) -> list[AdminQuestionStatRead]:
    question_values: dict[str, list[float]] = defaultdict(list)
    distributions: dict[str, dict[int, int]] = defaultdict(lambda: {value: 0 for value in range(5)})

    for response_session in sessions:
        answers_by_question_code = {answer.question_code: answer for answer in response_session.answers}
        for question in ordered_questions:
            answer = answers_by_question_code.get(question.code)
            if answer is None:
                continue
            question_values[question.code].append(float(answer.value))
            distributions[question.code][answer.value] = distributions[question.code].get(answer.value, 0) + 1

    question_stats: list[AdminQuestionStatRead] = []
    total_sessions = len(sessions)
    for question in ordered_questions:
        values = question_values.get(question.code, [])
        scale = scale_by_code[question.scale_code]
        count = len(values)
        question_stats.append(
            AdminQuestionStatRead(
                question_id=question.id,
                question_code=question.code,
                question_order=question.number,
                question_text=question.prompt,
                scale_code=question.scale_code,
                scale_name=scale.title,
                mean_answer=_round(mean(values)) or 0.0,
                variance=_round(sample_variance(values)) or 0.0,
                standard_deviation=_round(sample_standard_deviation(values)) or 0.0,
                count=count,
                missing_count=max(total_sessions - count, 0),
                distribution=[
                    AdminDistributionBucketRead(value=value, count=distributions[question.code].get(value, 0))
                    for value in range(5)
                ],
            )
        )

    return question_stats


def collect_analytics_summary(db: Session) -> AnalyticsSummaryRead:
    total_attempts = db.scalar(select(func.count()).select_from(ResponseSession)) or 0
    completed_tests = db.scalar(
        select(func.count()).select_from(ResponseSession).where(ResponseSession.status == "submitted")
    ) or 0

    distribution_rows = db.execute(
        select(
            ComputedResult.main_flower_code,
            ComputedResult.main_flower_title,
            ComputedResult.main_flower_symbol,
            func.count(ComputedResult.id).label("count"),
        )
        .join(ResponseSession, ResponseSession.id == ComputedResult.response_session_id)
        .where(ResponseSession.status == "submitted")
        .group_by(
            ComputedResult.main_flower_code,
            ComputedResult.main_flower_title,
            ComputedResult.main_flower_symbol,
        )
        .order_by(func.count(ComputedResult.id).desc(), ComputedResult.main_flower_title.asc())
    ).all()

    average_rows = db.execute(
        select(
            SurveyScale.code,
            SurveyScale.title,
            SurveyScale.short_code,
            func.avg(ScaleScore.raw_score).label("average_raw_score"),
        )
        .select_from(ScaleScore)
        .join(ComputedResult, ComputedResult.id == ScaleScore.computed_result_id)
        .join(ResponseSession, ResponseSession.id == ComputedResult.response_session_id)
        .join(
            SurveyScale,
            and_(
                SurveyScale.survey_id == ResponseSession.survey_id,
                SurveyScale.code == ScaleScore.scale_code,
            ),
        )
        .where(ResponseSession.status == "submitted")
        .group_by(SurveyScale.code, SurveyScale.title, SurveyScale.short_code, SurveyScale.sort_order)
        .order_by(SurveyScale.sort_order.asc(), SurveyScale.code.asc())
    ).all()

    return AnalyticsSummaryRead(
        total_attempts=total_attempts,
        completed_tests=completed_tests,
        main_flower_distribution=[
            AnalyticsFlowerDistributionRead(
                flower_code=row.main_flower_code,
                flower_title=row.main_flower_title,
                flower_symbol=row.main_flower_symbol,
                count=row.count,
            )
            for row in distribution_rows
        ],
        average_raw_scores=[
            AnalyticsScaleAverageRead(
                scale_code=row.code,
                scale_title=row.title,
                short_code=row.short_code,
                average_raw_score=round(float(row.average_raw_score), 4),
            )
            for row in average_rows
        ],
    )


def collect_export_rows(db: Session) -> list[AnalyticsExportRowRead]:
    rows = db.execute(
        select(
            ComputedResult.id.label("computed_result_id"),
            ResponseSession.id.label("response_session_id"),
            User.id.label("user_id"),
            User.username,
            User.is_guest.label("is_guest_session"),
            Survey.code.label("survey_code"),
            Survey.version.label("survey_version"),
            ComputedResult.main_flower_code,
            ComputedResult.main_flower_title,
            ComputedResult.tie_break_strategy,
            ComputedResult.mean_value.label("mean"),
            ComputedResult.standard_deviation.label("standard_deviation"),
            ResponseSession.submitted_at,
            ScaleScore.scale_code,
            SurveyScale.title.label("scale_title"),
            ScaleScore.raw_score,
            ScaleScore.z_score,
        )
        .select_from(ScaleScore)
        .join(ComputedResult, ComputedResult.id == ScaleScore.computed_result_id)
        .join(ResponseSession, ResponseSession.id == ComputedResult.response_session_id)
        .join(User, User.id == ResponseSession.user_id)
        .join(Survey, Survey.id == ResponseSession.survey_id)
        .join(
            SurveyScale,
            and_(
                SurveyScale.survey_id == ResponseSession.survey_id,
                SurveyScale.code == ScaleScore.scale_code,
            ),
        )
        .where(ResponseSession.status == "submitted")
        .order_by(
            ResponseSession.submitted_at.desc().nullslast(),
            ResponseSession.created_at.desc(),
            ScaleScore.rank.asc(),
        )
    ).all()

    return [
        AnalyticsExportRowRead(
            computed_result_id=row.computed_result_id,
            response_session_id=row.response_session_id,
            user_id=row.user_id,
            username=row.username,
            is_guest_session=row.is_guest_session,
            survey_code=row.survey_code,
            survey_version=row.survey_version,
            main_flower_code=row.main_flower_code,
            main_flower_title=row.main_flower_title,
            tie_break_strategy=row.tie_break_strategy,
            mean=round(float(row.mean), 4),
            standard_deviation=round(float(row.standard_deviation), 4),
            submitted_at=row.submitted_at,
            scale_code=row.scale_code,
            scale_title=row.scale_title,
            raw_score=row.raw_score,
            z_score=round(float(row.z_score), 4),
        )
        for row in rows
    ]


def collect_respondent_raw_scores(db: Session, session_id: str) -> AdminRespondentRawScoresRead:
    response_session = db.scalar(_submitted_sessions_query().where(ResponseSession.id == session_id))
    if not response_session:
        raise LookupError("Прохождение не найдено")

    survey = response_session.survey
    scale_by_code = _scale_lookup(survey)
    question_by_code = _question_lookup(survey)
    scale_scores = _scale_score_lookup(response_session)
    raw_scores = _raw_score_map(
        response_session,
        question_by_code=question_by_code,
        scale_by_code=scale_by_code,
    )
    answers_by_question_code = {answer.question_code: answer for answer in response_session.answers}

    scales: list[AdminRespondentScaleRead] = []
    for scale in _ordered_scales(survey):
        questions: list[AdminRespondentQuestionRead] = []
        for question in _ordered_questions(survey, scale_code=scale.code):
            answer = answers_by_question_code.get(question.code)
            answer_value = answer.value if answer else None
            questions.append(
                AdminRespondentQuestionRead(
                    question_id=question.id,
                    question_code=question.code,
                    question_order=question.number,
                    question_text=question.prompt,
                    scale_code=scale.code,
                    scale_name=scale.title,
                    answer_value=answer_value,
                    contribution_to_scale=answer_value,
                )
            )

        scale_score = scale_scores.get(scale.code)
        scales.append(
            AdminRespondentScaleRead(
                scale_code=scale.code,
                scale_name=scale.title,
                flower_code=scale_score.flower_code if scale_score else scale.flower_code,
                flower_title=scale_score.flower_title if scale_score else scale.title,
                flower_symbol=scale_score.flower_symbol if scale_score else None,
                raw_score=raw_scores.get(scale.code, 0),
                z_score=_round(scale_score.z_score) or 0.0 if scale_score else 0.0,
                rank=scale_score.rank if scale_score else len(scales) + 1,
                questions=questions,
            )
        )

    scales.sort(key=lambda item: (item.rank, item.scale_code))

    computed_result = response_session.computed_result
    main_scale = next((scale for scale in scales if scale.rank == 1), scales[0] if scales else None)
    secondary_scale = next((scale for scale in scales if scale.rank == 2), None)
    interpretation_payload = computed_result.result_payload.get("interpretation") if computed_result else None

    return AdminRespondentRawScoresRead(
        session_id=response_session.id,
        user_id=response_session.user.id,
        username=response_session.user.username,
        respondent_label=_respondent_label(response_session.user),
        is_guest=response_session.user.is_guest,
        submitted_at=response_session.submitted_at,
        duration_seconds=_duration_seconds(response_session),
        mean=_round(computed_result.mean_value) if computed_result else None,
        standard_deviation=_round(computed_result.standard_deviation) if computed_result else None,
        main_flower=(
            AdminRespondentMainFlowerRead(
                scale_code=main_scale.scale_code,
                flower_code=main_scale.flower_code,
                flower_title=main_scale.flower_title,
                flower_symbol=main_scale.flower_symbol,
                raw_score=main_scale.raw_score,
                z_score=main_scale.z_score,
            )
            if main_scale
            else None
        ),
        secondary_flower=(
            AdminRespondentMainFlowerRead(
                scale_code=secondary_scale.scale_code,
                flower_code=secondary_scale.flower_code,
                flower_title=secondary_scale.flower_title,
                flower_symbol=secondary_scale.flower_symbol,
                raw_score=secondary_scale.raw_score,
                z_score=secondary_scale.z_score,
            )
            if secondary_scale
            else None
        ),
        interpretation=(
            AdminRespondentInterpretationRead(
                z_level_code=interpretation_payload.get("z_level_code"),
                z_level_title=interpretation_payload.get("z_level_title"),
                profile_title=interpretation_payload.get("profile_title"),
                profile_summary=interpretation_payload.get("profile_summary"),
                z_summary=interpretation_payload.get("z_summary"),
            )
            if interpretation_payload
            else None
        ),
        scales=scales,
    )


def collect_respondents_raw_matrix(
    db: Session,
    *,
    scale_code: str | None = None,
) -> AdminRespondentRawMatrixRead:
    survey = _active_survey(db)
    scale_by_code = _scale_lookup(survey)
    if scale_code and scale_code not in scale_by_code:
        raise LookupError("Шкала не найдена")

    ordered_scales = _ordered_scales(survey)
    ordered_questions = _ordered_questions(survey, scale_code=scale_code)
    question_by_code = _question_lookup(survey)
    sessions = db.scalars(_submitted_sessions_query()).all()

    respondents: list[AdminRespondentMatrixRowRead] = []
    for response_session in sessions:
        answers_by_question_code = {answer.question_code: answer for answer in response_session.answers}
        scale_scores = _scale_score_lookup(response_session)
        raw_scores = _raw_score_map(
            response_session,
            question_by_code=question_by_code,
            scale_by_code=scale_by_code,
        )
        answers_payload: dict[str, int | None] = {}
        for question in ordered_questions:
            answer = answers_by_question_code.get(question.code)
            value = answer.value if answer else None
            answers_payload[question.code] = value

        respondents.append(
            AdminRespondentMatrixRowRead(
                session_id=response_session.id,
                user_id=response_session.user.id,
                username=response_session.user.username,
                respondent_label=_respondent_label(response_session.user),
                is_guest=response_session.user.is_guest,
                submitted_at=response_session.submitted_at,
                duration_seconds=_duration_seconds(response_session),
                main_flower_code=response_session.computed_result.main_flower_code if response_session.computed_result else None,
                main_flower_title=response_session.computed_result.main_flower_title if response_session.computed_result else None,
                raw_scores_by_scale={scale.code: raw_scores.get(scale.code, 0) for scale in ordered_scales},
                z_scores_by_scale={
                    scale.code: _round(scale_scores[scale.code].z_score) or 0.0 if scale.code in scale_scores else 0.0
                    for scale in ordered_scales
                },
                answers_by_question=answers_payload,
            )
        )

    question_stats = _build_question_stats(
        sessions,
        ordered_questions=ordered_questions,
        scale_by_code=scale_by_code,
    )

    return AdminRespondentRawMatrixRead(
        scales=[_build_scale_meta(scale) for scale in ordered_scales],
        questions=[
            _build_question_meta(question, scale_name=scale_by_code[question.scale_code].title)
            for question in ordered_questions
        ],
        respondents=respondents,
        question_stats=question_stats,
    )


def collect_question_stats(
    db: Session,
    *,
    scale_code: str | None = None,
) -> AdminQuestionStatsPayloadRead:
    survey = _active_survey(db)
    scale_by_code = _scale_lookup(survey)
    if scale_code and scale_code not in scale_by_code:
        raise LookupError("Шкала не найдена")

    ordered_scales = _ordered_scales(survey)
    ordered_questions = _ordered_questions(survey, scale_code=scale_code)
    sessions = db.scalars(_submitted_sessions_query()).all()

    return AdminQuestionStatsPayloadRead(
        scale_code=scale_code,
        respondents_count=len(sessions),
        scales=[_build_scale_meta(scale) for scale in ordered_scales],
        questions=_build_question_stats(
            sessions,
            ordered_questions=ordered_questions,
            scale_by_code=scale_by_code,
        ),
    )


def collect_detailed_export_rows(db: Session) -> tuple[list[str], list[dict[str, Any]]]:
    survey = _active_survey(db)
    ordered_scales = _ordered_scales(survey)
    ordered_questions = _ordered_questions(survey)
    question_by_code = _question_lookup(survey)
    scale_by_code = _scale_lookup(survey)
    sessions = db.scalars(_submitted_sessions_query()).all()

    question_headers = [f"q{question.number}" for question in ordered_questions]
    scale_headers = [f"scale_{scale.flower_code}_raw" for scale in ordered_scales]
    z_headers = [f"scale_{scale.flower_code}_z" for scale in ordered_scales]
    headers = [
        "session_id",
        "user_id",
        "username",
        "respondent_label",
        "is_guest",
        "submitted_at",
        "duration_seconds",
        "main_flower_code",
        "main_flower_title",
        "mean",
        "standard_deviation",
        *question_headers,
        *scale_headers,
        *z_headers,
    ]

    rows: list[dict[str, Any]] = []
    for response_session in sessions:
        answers_by_question_code = {answer.question_code: answer for answer in response_session.answers}
        scale_scores = _scale_score_lookup(response_session)
        raw_scores = _raw_score_map(
            response_session,
            question_by_code=question_by_code,
            scale_by_code=scale_by_code,
        )
        row: dict[str, Any] = {
            "session_id": response_session.id,
            "user_id": response_session.user.id,
            "username": response_session.user.username,
            "respondent_label": _respondent_label(response_session.user),
            "is_guest": response_session.user.is_guest,
            "submitted_at": response_session.submitted_at.isoformat() if response_session.submitted_at else None,
            "duration_seconds": _duration_seconds(response_session),
            "main_flower_code": response_session.computed_result.main_flower_code if response_session.computed_result else None,
            "main_flower_title": response_session.computed_result.main_flower_title if response_session.computed_result else None,
            "mean": _round(response_session.computed_result.mean_value) if response_session.computed_result else None,
            "standard_deviation": (
                _round(response_session.computed_result.standard_deviation) if response_session.computed_result else None
            ),
        }
        for question in ordered_questions:
            answer = answers_by_question_code.get(question.code)
            row[f"q{question.number}"] = answer.value if answer else None
        for scale in ordered_scales:
            row[f"scale_{scale.flower_code}_raw"] = raw_scores.get(scale.code, 0)
            row[f"scale_{scale.flower_code}_z"] = (
                _round(scale_scores[scale.code].z_score) if scale.code in scale_scores else None
            )
        rows.append(row)

    return headers, rows


def collect_internal_consistency(db: Session, *, scale_code: str) -> InternalConsistencyRead:
    survey = _active_survey(db)
    scale_by_code = _scale_lookup(survey)
    scale = scale_by_code.get(scale_code)
    if not scale:
        raise LookupError("Шкала не найдена")

    questions = _ordered_questions(survey, scale_code=scale_code)
    question_by_code = {question.code: question for question in questions}
    sessions = db.scalars(
        _submitted_sessions_query().where(ResponseSession.survey_id == scale.survey_id)
    ).all()

    matrix: list[list[float]] = []
    for response_session in sessions:
        answers_by_question_code = {answer.question_code: answer for answer in response_session.answers}
        row: list[float] = []
        complete = True
        for question in questions:
            answer = answers_by_question_code.get(question.code)
            if answer is None:
                complete = False
                break
            row.append(float(answer.value))
        if complete:
            matrix.append(row)

    respondents_count = len(matrix)
    questions_count = len(questions)
    overall_alpha = cronbach_alpha(matrix)

    if respondents_count < 2:
        message = "Для расчёта внутренней согласованности нужны как минимум два завершённых прохождения."
    elif questions_count < 2:
        message = "Для расчёта внутренней согласованности в шкале должно быть минимум два вопроса."
    elif overall_alpha is None:
        message = "Недостаточно вариативности ответов для стабильного расчёта коэффициентов."
    else:
        message = None

    items: list[InternalConsistencyItemRead] = []
    for index, question in enumerate(questions):
        column = [row[index] for row in matrix]
        items.append(
            InternalConsistencyItemRead(
                question_id=question.id,
                question_code=question.code,
                question_order=question.number,
                question_text=question.prompt,
                mean=_round(mean(column)) or 0.0,
                variance=_round(sample_variance(column)) or 0.0,
                standard_deviation=_round(sample_standard_deviation(column)) or 0.0,
                item_total_correlation=_round(corrected_item_total_correlation(matrix, index)),
                alpha_if_deleted=_round(cronbach_alpha_if_item_deleted(matrix, index)),
            )
        )

    return InternalConsistencyRead(
        scale_code=scale.code,
        scale_name=scale.title,
        respondents_count=respondents_count,
        questions_count=questions_count,
        cronbach_alpha=_round(overall_alpha),
        insufficient_data=message is not None,
        message=message,
        items=items,
    )
