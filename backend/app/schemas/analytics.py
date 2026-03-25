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


class AdminRespondentMatrixRowRead(BaseModel):
    session_id: str
    user_id: str
    username: str
    respondent_label: str
    is_guest: bool
    submitted_at: datetime | None
    raw_scores_by_scale: dict[str, int]
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


class AdminRespondentScaleRead(BaseModel):
    scale_code: str
    scale_name: str
    raw_score: int
    questions: list[AdminRespondentQuestionRead]


class AdminRespondentRawScoresRead(BaseModel):
    session_id: str
    user_id: str
    username: str
    respondent_label: str
    is_guest: bool
    submitted_at: datetime | None
    scales: list[AdminRespondentScaleRead]


class InternalConsistencyItemRead(BaseModel):
    question_id: str
    question_code: str
    question_order: int
    question_text: str
    mean: float
    variance: float
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
