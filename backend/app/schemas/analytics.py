from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AdminScaleMetaRead(BaseModel):
    scale_code: str
    scale_name: str
    short_code: str
    flower_code: str


class AdminQuestionMetaRead(BaseModel):
    question_id: str
    question_code: str
    question_order: int
    question_text: str
    scale_code: str
    scale_name: str


class AdminQuestionStatRead(AdminQuestionMetaRead):
    mean_answer: float
    variance: float
    standard_deviation: float
    count: int
    missing_count: int
    distribution: list["AdminDistributionBucketRead"]


class AdminDistributionBucketRead(BaseModel):
    value: int
    count: int


class AdminQuestionStatsPayloadRead(BaseModel):
    scale_code: str | None
    respondents_count: int
    scales: list[AdminScaleMetaRead]
    questions: list[AdminQuestionStatRead]


class AdminRespondentMatrixRowRead(BaseModel):
    session_id: str
    user_id: str
    username: str
    respondent_label: str
    is_guest: bool
    submitted_at: datetime | None
    duration_seconds: int | None
    main_flower_code: str | None
    main_flower_title: str | None
    raw_scores_by_scale: dict[str, int]
    z_scores_by_scale: dict[str, float]
    answers_by_question: dict[str, int | None]


class AdminRespondentRawMatrixRead(BaseModel):
    scales: list[AdminScaleMetaRead]
    questions: list[AdminQuestionMetaRead]
    respondents: list[AdminRespondentMatrixRowRead]
    question_stats: list[AdminQuestionStatRead]


class AdminRespondentQuestionRead(BaseModel):
    question_id: str
    question_code: str
    question_order: int
    question_text: str
    scale_code: str
    scale_name: str
    answer_value: int | None
    contribution_to_scale: int | None


class AdminRespondentMainFlowerRead(BaseModel):
    scale_code: str
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    raw_score: int
    z_score: float


class AdminRespondentInterpretationRead(BaseModel):
    z_level_code: str | None
    z_level_title: str | None
    profile_title: str | None
    profile_summary: str | None
    z_summary: str | None


class AdminRespondentScaleRead(BaseModel):
    scale_code: str
    scale_name: str
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    raw_score: int
    z_score: float
    rank: int
    questions: list[AdminRespondentQuestionRead]


class AdminRespondentRawScoresRead(BaseModel):
    session_id: str
    user_id: str
    username: str
    respondent_label: str
    is_guest: bool
    submitted_at: datetime | None
    duration_seconds: int | None
    mean: float | None
    standard_deviation: float | None
    main_flower: AdminRespondentMainFlowerRead | None
    secondary_flower: AdminRespondentMainFlowerRead | None
    interpretation: AdminRespondentInterpretationRead | None
    scales: list[AdminRespondentScaleRead]


class InternalConsistencyItemRead(BaseModel):
    question_id: str
    question_code: str
    question_order: int
    question_text: str
    mean: float
    variance: float
    standard_deviation: float
    item_total_correlation: float | None
    alpha_if_deleted: float | None


class InternalConsistencyRead(BaseModel):
    scale_code: str
    scale_name: str
    respondents_count: int
    questions_count: int
    cronbach_alpha: float | None
    insufficient_data: bool
    message: str | None = None
    items: list[InternalConsistencyItemRead]
