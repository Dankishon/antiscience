from __future__ import annotations

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.response import ComputedResult, ResponseSession, ScaleScore
from app.models.survey import Survey, SurveyScale
from app.models.user import User
from app.schemas.response import (
    AnalyticsExportRowRead,
    AnalyticsFlowerDistributionRead,
    AnalyticsScaleAverageRead,
    AnalyticsSummaryRead,
)


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
