from __future__ import annotations

import csv
import io
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    AdminRespondentRawMatrixRead,
    AdminRespondentRawScoresRead,
    InternalConsistencyRead,
)
from app.schemas.response import AnalyticsExportRowRead, AnalyticsSummaryRead
from app.services.analytics import (
    collect_analytics_summary,
    collect_detailed_export_rows,
    collect_export_rows,
    collect_internal_consistency,
    collect_respondent_raw_scores,
    collect_respondents_raw_matrix,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _serialize_export_csv(rows: list[AnalyticsExportRowRead]) -> str:
    return _serialize_csv(
        [
            "computed_result_id",
            "response_session_id",
            "user_id",
            "username",
            "is_guest_session",
            "survey_code",
            "survey_version",
            "main_flower_code",
            "main_flower_title",
            "tie_break_strategy",
            "mean",
            "standard_deviation",
            "submitted_at",
            "scale_code",
            "scale_title",
            "raw_score",
            "z_score",
        ],
        [row.model_dump(mode="json") for row in rows],
    )


def _serialize_csv(fieldnames: list[str], rows: list[dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


@router.get("/analytics/summary", response_model=AnalyticsSummaryRead)
def get_analytics_summary(
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AnalyticsSummaryRead:
    return collect_analytics_summary(db)


@router.get("/analytics/export", response_model=None)
def export_analytics(
    format: Literal["json", "csv"] = Query(default="json"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> list[AnalyticsExportRowRead] | StreamingResponse:
    rows = collect_export_rows(db)
    if format == "csv":
        payload = _serialize_export_csv(rows)
        return StreamingResponse(
            iter([payload]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="flower-profile-analytics.csv"'},
        )
    return rows


@router.get("/analytics/respondents/{session_id}/raw-scores", response_model=AdminRespondentRawScoresRead)
def get_respondent_raw_scores(
    session_id: str,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminRespondentRawScoresRead:
    try:
        return collect_respondent_raw_scores(db, session_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/analytics/respondents/raw-matrix", response_model=AdminRespondentRawMatrixRead)
def get_respondents_raw_matrix(
    scale_code: str | None = Query(default=None),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> AdminRespondentRawMatrixRead:
    try:
        return collect_respondents_raw_matrix(db, scale_code=scale_code)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/analytics/export/detailed", response_model=None)
def export_detailed_analytics(
    format: Literal["json", "csv"] = Query(default="json"),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]] | StreamingResponse:
    fieldnames, rows = collect_detailed_export_rows(db)
    if format == "csv":
        payload = _serialize_csv(fieldnames, rows)
        return StreamingResponse(
            iter([payload]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="flower-profile-detailed-analytics.csv"'},
        )
    return rows


@router.get("/analytics/internal-consistency", response_model=InternalConsistencyRead)
def get_internal_consistency(
    scale_code: str = Query(...),
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> InternalConsistencyRead:
    try:
        return collect_internal_consistency(db, scale_code=scale_code)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
