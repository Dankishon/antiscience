from __future__ import annotations

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.response import AnalyticsExportRowRead, AnalyticsSummaryRead
from app.services.analytics import collect_analytics_summary, collect_export_rows

router = APIRouter(prefix="/admin", tags=["admin"])


def _serialize_export_csv(rows: list[AnalyticsExportRowRead]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
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
    )
    writer.writeheader()
    for row in rows:
        writer.writerow(row.model_dump(mode="json"))
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
