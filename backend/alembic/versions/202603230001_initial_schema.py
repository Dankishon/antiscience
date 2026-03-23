"""initial schema

Revision ID: 202603230001
Revises:
Create Date: 2026-03-23 00:01:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "202603230001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_guest", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_created_at", "users", ["created_at"])

    op.create_table(
        "surveys",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column("algorithm_version", sa.String(length=32), nullable=False),
        sa.Column("source_document", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", "version", name="uq_surveys_code_version"),
    )

    op.create_table(
        "flowers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("survey_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("symbol", sa.String(length=16), nullable=True),
        sa.Column("scale_code", sa.String(length=16), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("meaning", sa.Text(), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("survey_id", "code", name="uq_flowers_survey_code"),
        sa.UniqueConstraint("survey_id", "scale_code", name="uq_flowers_survey_scale_code"),
    )

    op.create_table(
        "questions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("survey_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("scale_code", sa.String(length=16), nullable=False),
        sa.Column("flower_code", sa.String(length=64), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("min_value", sa.Integer(), nullable=False),
        sa.Column("max_value", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Integer(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("survey_id", "code", name="uq_questions_survey_code"),
        sa.UniqueConstraint("survey_id", "number", name="uq_questions_survey_number"),
    )

    op.create_table(
        "response_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("survey_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_response_sessions_user_created", "response_sessions", ["user_id", "created_at"])

    op.create_table(
        "answers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("response_session_id", sa.String(length=36), nullable=False),
        sa.Column("question_code", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["response_session_id"], ["response_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("response_session_id", "question_code", name="uq_answers_session_question"),
    )

    op.create_table(
        "computed_results",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("response_session_id", sa.String(length=36), nullable=False),
        sa.Column("main_flower_code", sa.String(length=64), nullable=False),
        sa.Column("main_flower_title", sa.String(length=128), nullable=False),
        sa.Column("main_flower_symbol", sa.String(length=16), nullable=True),
        sa.Column("mean_value", sa.Float(), nullable=False),
        sa.Column("standard_deviation", sa.Float(), nullable=False),
        sa.Column("tie_break_strategy", sa.String(length=32), nullable=False),
        sa.Column("result_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["response_session_id"], ["response_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("response_session_id", name="uq_computed_results_session"),
    )

    op.create_table(
        "scale_scores",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("computed_result_id", sa.String(length=36), nullable=False),
        sa.Column("scale_code", sa.String(length=16), nullable=False),
        sa.Column("flower_code", sa.String(length=64), nullable=False),
        sa.Column("flower_title", sa.String(length=128), nullable=False),
        sa.Column("flower_symbol", sa.String(length=16), nullable=True),
        sa.Column("raw_score", sa.Integer(), nullable=False),
        sa.Column("z_score", sa.Float(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["computed_result_id"], ["computed_results.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("computed_result_id", "scale_code", name="uq_scale_scores_result_scale"),
    )


def downgrade() -> None:
    op.drop_table("scale_scores")
    op.drop_table("computed_results")
    op.drop_table("answers")
    op.drop_index("ix_response_sessions_user_created", table_name="response_sessions")
    op.drop_table("response_sessions")
    op.drop_table("questions")
    op.drop_table("flowers")
    op.drop_table("surveys")
    op.drop_index("ix_users_created_at", table_name="users")
    op.drop_table("users")
