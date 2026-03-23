"""extend result storage and analytics model

Revision ID: 202603230003
Revises: 202603230002
Create Date: 2026-03-23 19:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "202603230003"
down_revision = "202603230002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "survey_scales",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("survey_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("short_code", sa.String(length=32), nullable=False),
        sa.Column("flower_code", sa.String(length=64), nullable=False),
        sa.Column("min_score", sa.Integer(), nullable=False),
        sa.Column("max_score", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("seed_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["survey_id", "flower_code"], ["flowers.survey_id", "flowers.code"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("survey_id", "code", name="uq_survey_scales_survey_code"),
        sa.UniqueConstraint("survey_id", "flower_code", name="uq_survey_scales_survey_flower_code"),
        sa.UniqueConstraint("survey_id", "sort_order", name="uq_survey_scales_survey_sort_order"),
    )
    op.create_index("ix_survey_scales_survey_id", "survey_scales", ["survey_id"])

    op.create_table(
        "flower_interpretations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("survey_id", sa.String(length=36), nullable=False),
        sa.Column("flower_code", sa.String(length=64), nullable=False),
        sa.Column("entry_key", sa.String(length=64), nullable=False),
        sa.Column("entry_type", sa.String(length=24), nullable=False),
        sa.Column("z_level_code", sa.String(length=32), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("source_header", sa.Text(), nullable=True),
        sa.Column("source_range", sa.String(length=64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["survey_id", "flower_code"], ["flowers.survey_id", "flowers.code"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("survey_id", "flower_code", "entry_key", name="uq_flower_interpretations_entry"),
    )
    op.create_index("ix_flower_interpretations_lookup", "flower_interpretations", ["survey_id", "flower_code"])

    op.create_table(
        "flower_traits",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("survey_id", sa.String(length=36), nullable=False),
        sa.Column("flower_code", sa.String(length=64), nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("polarity", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["survey_id", "flower_code"], ["flowers.survey_id", "flowers.code"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("survey_id", "flower_code", "code", name="uq_flower_traits_code"),
    )
    op.create_index("ix_flower_traits_lookup", "flower_traits", ["survey_id", "flower_code"])

    op.create_index("ix_response_sessions_status_submitted_at", "response_sessions", ["status", "submitted_at"])
    op.create_index("ix_computed_results_main_flower_code", "computed_results", ["main_flower_code"])
    op.create_index("ix_scale_scores_scale_code", "scale_scores", ["scale_code"])


def downgrade() -> None:
    op.drop_index("ix_scale_scores_scale_code", table_name="scale_scores")
    op.drop_index("ix_computed_results_main_flower_code", table_name="computed_results")
    op.drop_index("ix_response_sessions_status_submitted_at", table_name="response_sessions")

    op.drop_index("ix_flower_traits_lookup", table_name="flower_traits")
    op.drop_table("flower_traits")

    op.drop_index("ix_flower_interpretations_lookup", table_name="flower_interpretations")
    op.drop_table("flower_interpretations")

    op.drop_index("ix_survey_scales_survey_id", table_name="survey_scales")
    op.drop_table("survey_scales")
