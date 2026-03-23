from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class CreateResponseRequest(BaseModel):
    survey_code: str | None = None
    survey_version: int | None = None


class AnswerInput(BaseModel):
    question_code: str
    value: int = Field(ge=0, le=4)


class AnswerBatchRequest(BaseModel):
    answers: list[AnswerInput]

    @field_validator("answers")
    @classmethod
    def validate_answers_not_empty(cls, value: list[AnswerInput]) -> list[AnswerInput]:
        if not value:
            raise ValueError("answers cannot be empty")
        return value


class ResponseSessionRead(BaseModel):
    id: str
    survey_code: str
    survey_version: int
    status: str
    answered_count: int
    total_questions: int
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None


class MainFlowerRead(BaseModel):
    scale_code: str
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    raw_score: int
    z_score: float


class TieBreakRead(BaseModel):
    applied: bool
    strategy: str
    candidate_flower_codes: list[str]


class ScaleScoreRead(BaseModel):
    scale_code: str
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    raw_score: int
    z_score: float
    rank: int
    z_level_code: str | None
    z_level_title: str | None


class InterpretationRead(BaseModel):
    z_level_code: str | None
    z_level_title: str | None
    profile_title: str | None
    profile_summary: str | None
    profile_source_header: str | None
    z_summary: str | None
    traits: list[dict]


class ResultRead(BaseModel):
    response_session_id: str
    survey_code: str
    survey_version: int
    algorithm_version: str
    mean: float
    standard_deviation: float
    main_flower: MainFlowerRead
    tie_break: TieBreakRead
    scale_scores: list[ScaleScoreRead]
    interpretation: InterpretationRead
    submitted_at: datetime | None


class ResultHistoryItemRead(BaseModel):
    id: str
    response_session_id: str
    is_guest_session: bool
    main_flower: MainFlowerRead
    mean: float
    standard_deviation: float
    tie_break_strategy: str
    submitted_at: datetime | None
    created_at: datetime


class StoredResultRead(ResultRead):
    id: str
    is_guest_session: bool
    created_at: datetime


class DeleteResultResponse(BaseModel):
    ok: bool


class AnalyticsFlowerDistributionRead(BaseModel):
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    count: int


class AnalyticsScaleAverageRead(BaseModel):
    scale_code: str
    scale_title: str
    short_code: str
    average_raw_score: float


class AnalyticsSummaryRead(BaseModel):
    total_attempts: int
    completed_tests: int
    main_flower_distribution: list[AnalyticsFlowerDistributionRead]
    average_raw_scores: list[AnalyticsScaleAverageRead]


class AnalyticsExportRowRead(BaseModel):
    computed_result_id: str
    response_session_id: str
    user_id: str
    username: str
    is_guest_session: bool
    survey_code: str
    survey_version: int
    main_flower_code: str
    main_flower_title: str
    tie_break_strategy: str
    mean: float
    standard_deviation: float
    submitted_at: datetime | None
    scale_code: str
    scale_title: str
    raw_score: int
    z_score: float
