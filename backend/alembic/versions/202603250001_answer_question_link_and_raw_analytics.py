"""link answers to questions for raw analytics

Revision ID: 202603250001
Revises: 202603230003
Create Date: 2026-03-25 10:15:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "202603250001"
down_revision = "202603230003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("answers", sa.Column("question_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_answers_question_id_questions",
        "answers",
        "questions",
        ["question_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_answers_question_id", "answers", ["question_id"])
    op.create_index("ix_answers_response_session_id", "answers", ["response_session_id"])

    bind = op.get_bind()
    answers = sa.table(
        "answers",
        sa.column("id", sa.String(length=36)),
        sa.column("response_session_id", sa.String(length=36)),
        sa.column("question_code", sa.String(length=64)),
        sa.column("question_id", sa.String(length=36)),
    )
    response_sessions = sa.table(
        "response_sessions",
        sa.column("id", sa.String(length=36)),
        sa.column("survey_id", sa.String(length=36)),
    )
    questions = sa.table(
        "questions",
        sa.column("id", sa.String(length=36)),
        sa.column("survey_id", sa.String(length=36)),
        sa.column("code", sa.String(length=64)),
    )

    question_rows = bind.execute(
        sa.select(questions.c.id, questions.c.survey_id, questions.c.code)
    ).fetchall()
    question_lookup = {
        (row.survey_id, row.code): row.id
        for row in question_rows
    }

    answer_rows = bind.execute(
        sa.select(
            answers.c.id,
            response_sessions.c.survey_id,
            answers.c.question_code,
        ).select_from(
            answers.join(
                response_sessions,
                answers.c.response_session_id == response_sessions.c.id,
            )
        )
    ).fetchall()

    for row in answer_rows:
        question_id = question_lookup.get((row.survey_id, row.question_code))
        if not question_id:
            raise RuntimeError(
                f"Unable to backfill question_id for answer {row.id} ({row.question_code})"
            )
        bind.execute(
            sa.update(answers)
            .where(answers.c.id == row.id)
            .values(question_id=question_id)
        )

    op.alter_column("answers", "question_id", existing_type=sa.String(length=36), nullable=False)


def downgrade() -> None:
    op.drop_index("ix_answers_response_session_id", table_name="answers")
    op.drop_index("ix_answers_question_id", table_name="answers")
    op.drop_constraint("fk_answers_question_id_questions", "answers", type_="foreignkey")
    op.drop_column("answers", "question_id")
