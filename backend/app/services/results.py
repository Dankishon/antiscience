from __future__ import annotations

from app.models.response import ComputedResult, ResponseSession
from app.schemas.response import ResultHistoryItemRead, ResultRead, StoredResultRead


def build_result_read(response_session: ResponseSession) -> ResultRead:
    if not response_session.computed_result:
        raise ValueError("Computed result is not available for this response session")

    payload = response_session.computed_result.result_payload
    return ResultRead(
        **payload,
        response_session_id=response_session.id,
        submitted_at=response_session.submitted_at,
    )


def build_stored_result_read(response_session: ResponseSession) -> StoredResultRead:
    if not response_session.computed_result:
        raise ValueError("Computed result is not available for this response session")

    result = response_session.computed_result
    payload = result.result_payload
    return StoredResultRead(
        id=result.id,
        is_guest_session=response_session.user.is_guest,
        created_at=result.created_at,
        **payload,
        response_session_id=response_session.id,
        submitted_at=response_session.submitted_at,
    )


def build_result_history_item(result: ComputedResult, response_session: ResponseSession) -> ResultHistoryItemRead:
    payload = result.result_payload
    return ResultHistoryItemRead(
        id=result.id,
        response_session_id=response_session.id,
        is_guest_session=response_session.user.is_guest,
        main_flower=payload["main_flower"],
        mean=payload["mean"],
        standard_deviation=payload["standard_deviation"],
        tie_break_strategy=result.tie_break_strategy,
        submitted_at=response_session.submitted_at,
        created_at=result.created_at,
    )
