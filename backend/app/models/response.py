from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ResponseSession(Base):
    __tablename__ = "response_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    survey_id: Mapped[str] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="in_progress")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="response_sessions")
    survey = relationship("Survey", back_populates="response_sessions")
    answers = relationship("Answer", back_populates="response_session", cascade="all, delete-orphan")
    computed_result = relationship(
        "ComputedResult", back_populates="response_session", cascade="all, delete-orphan", uselist=False
    )


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    response_session_id: Mapped[str] = mapped_column(
        ForeignKey("response_sessions.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    question_code: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    response_session = relationship("ResponseSession", back_populates="answers")
    question = relationship("Question", back_populates="answers")


class ComputedResult(Base):
    __tablename__ = "computed_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    response_session_id: Mapped[str] = mapped_column(
        ForeignKey("response_sessions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    main_flower_code: Mapped[str] = mapped_column(String(64), nullable=False)
    main_flower_title: Mapped[str] = mapped_column(String(128), nullable=False)
    main_flower_symbol: Mapped[str | None] = mapped_column(String(16), nullable=True)
    mean_value: Mapped[float] = mapped_column(Float, nullable=False)
    standard_deviation: Mapped[float] = mapped_column(Float, nullable=False)
    tie_break_strategy: Mapped[str] = mapped_column(String(32), nullable=False)
    result_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    response_session = relationship("ResponseSession", back_populates="computed_result")
    scale_scores = relationship("ScaleScore", back_populates="computed_result", cascade="all, delete-orphan")


class ScaleScore(Base):
    __tablename__ = "scale_scores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    computed_result_id: Mapped[str] = mapped_column(
        ForeignKey("computed_results.id", ondelete="CASCADE"), nullable=False
    )
    scale_code: Mapped[str] = mapped_column(String(16), nullable=False)
    flower_code: Mapped[str] = mapped_column(String(64), nullable=False)
    flower_title: Mapped[str] = mapped_column(String(128), nullable=False)
    flower_symbol: Mapped[str | None] = mapped_column(String(16), nullable=True)
    raw_score: Mapped[int] = mapped_column(Integer, nullable=False)
    z_score: Mapped[float] = mapped_column(Float, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    computed_result = relationship("ComputedResult", back_populates="scale_scores")
