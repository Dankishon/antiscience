from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Survey(Base):
    __tablename__ = "surveys"
    __table_args__ = (
        UniqueConstraint("code", "version", name="uq_surveys_code_version"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(32), nullable=False)
    source_document: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    flowers = relationship("Flower", back_populates="survey", cascade="all, delete-orphan")
    survey_scales = relationship("SurveyScale", back_populates="survey", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="survey", cascade="all, delete-orphan")
    flower_interpretations = relationship(
        "FlowerInterpretation",
        back_populates="survey",
        cascade="all, delete-orphan",
    )
    flower_traits = relationship("FlowerTrait", back_populates="survey", cascade="all, delete-orphan")
    response_sessions = relationship("ResponseSession", back_populates="survey", cascade="all, delete-orphan")


class Flower(Base):
    __tablename__ = "flowers"
    __table_args__ = (
        UniqueConstraint("survey_id", "code", name="uq_flowers_survey_code"),
        UniqueConstraint("survey_id", "scale_code", name="uq_flowers_survey_scale_code"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    survey_id: Mapped[str] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    symbol: Mapped[str | None] = mapped_column(String(16), nullable=True)
    scale_code: Mapped[str] = mapped_column(String(16), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    meaning: Mapped[str | None] = mapped_column(Text, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)

    survey = relationship("Survey", back_populates="flowers")
    survey_scale = relationship(
        "SurveyScale",
        back_populates="flower",
        uselist=False,
        overlaps="survey,survey_scales",
    )
    interpretations = relationship(
        "FlowerInterpretation",
        back_populates="flower",
        cascade="all, delete-orphan",
        overlaps="survey,flower_interpretations",
    )
    traits = relationship(
        "FlowerTrait",
        back_populates="flower",
        cascade="all, delete-orphan",
        overlaps="survey,flower_traits",
    )


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint("survey_id", "code", name="uq_questions_survey_code"),
        UniqueConstraint("survey_id", "number", name="uq_questions_survey_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    survey_id: Mapped[str] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    scale_code: Mapped[str] = mapped_column(String(16), nullable=False)
    flower_code: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    min_value: Mapped[int] = mapped_column(Integer, nullable=False)
    max_value: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_required: Mapped[bool] = mapped_column(default=True, nullable=False)

    survey = relationship("Survey", back_populates="questions")
    answers = relationship("Answer", back_populates="question")


class SurveyScale(Base):
    __tablename__ = "survey_scales"
    __table_args__ = (
        ForeignKeyConstraint(
            ["survey_id", "flower_code"],
            ["flowers.survey_id", "flowers.code"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("survey_id", "code", name="uq_survey_scales_survey_code"),
        UniqueConstraint("survey_id", "flower_code", name="uq_survey_scales_survey_flower_code"),
        UniqueConstraint("survey_id", "sort_order", name="uq_survey_scales_survey_sort_order"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    survey_id: Mapped[str] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    short_code: Mapped[str] = mapped_column(String(32), nullable=False)
    flower_code: Mapped[str] = mapped_column(String(64), nullable=False)
    min_score: Mapped[int] = mapped_column(Integer, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    seed_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    survey = relationship("Survey", back_populates="survey_scales", overlaps="survey_scale")
    flower = relationship("Flower", back_populates="survey_scale", overlaps="survey,survey_scales")


class FlowerInterpretation(Base):
    __tablename__ = "flower_interpretations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["survey_id", "flower_code"],
            ["flowers.survey_id", "flowers.code"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("survey_id", "flower_code", "entry_key", name="uq_flower_interpretations_entry"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    survey_id: Mapped[str] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    flower_code: Mapped[str] = mapped_column(String(64), nullable=False)
    entry_key: Mapped[str] = mapped_column(String(64), nullable=False)
    entry_type: Mapped[str] = mapped_column(String(24), nullable=False)
    z_level_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_header: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_range: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    survey = relationship("Survey", back_populates="flower_interpretations", overlaps="interpretations")
    flower = relationship(
        "Flower",
        back_populates="interpretations",
        overlaps="flower_interpretations,survey",
    )


class FlowerTrait(Base):
    __tablename__ = "flower_traits"
    __table_args__ = (
        ForeignKeyConstraint(
            ["survey_id", "flower_code"],
            ["flowers.survey_id", "flowers.code"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("survey_id", "flower_code", "code", name="uq_flower_traits_code"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    survey_id: Mapped[str] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    flower_code: Mapped[str] = mapped_column(String(64), nullable=False)
    code: Mapped[str] = mapped_column(String(128), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    polarity: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    survey = relationship("Survey", back_populates="flower_traits", overlaps="traits")
    flower = relationship("Flower", back_populates="traits", overlaps="flower_traits,survey")
