from __future__ import annotations

from pydantic import BaseModel


class LikertOption(BaseModel):
    value: int
    label: str


class SurveyQuestionRead(BaseModel):
    code: str
    number: int
    prompt: str
    scale_code: str
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    min_value: int
    max_value: int


class ActiveSurveyRead(BaseModel):
    code: str
    version: int
    title: str
    description: str
    instruction: str
    algorithm_version: str
    question_count: int
    likert_scale: list[LikertOption]
    questions: list[SurveyQuestionRead]
