from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.survey import Flower, Question, Survey


@lru_cache
def load_question_seed() -> dict:
    settings = get_settings()
    return json.loads(Path(settings.seeds_dir, "questions.v1.json").read_text(encoding="utf-8"))


@lru_cache
def load_interpretation_seed() -> dict:
    settings = get_settings()
    return json.loads(Path(settings.seeds_dir, "interps.v1.json").read_text(encoding="utf-8"))


def ensure_seed_data(db: Session) -> None:
    payload = load_question_seed()
    survey_meta = payload["survey"]

    existing = db.scalar(
        select(Survey).where(
            Survey.code == survey_meta["code"],
            Survey.version == survey_meta["version"],
        )
    )
    if existing:
        return

    survey = Survey(
        code=survey_meta["code"],
        version=survey_meta["version"],
        title=survey_meta["title"],
        description=survey_meta["description"],
        instruction=survey_meta["instruction"],
        algorithm_version=survey_meta["algorithmVersion"],
        source_document=survey_meta.get("sourceDocument"),
    )
    db.add(survey)
    db.flush()

    flowers_by_scale: dict[str, Flower] = {}
    for item in payload["flowers"]:
        flower = Flower(
            survey_id=survey.id,
            code=item["code"],
            title=item["title"],
            symbol=item.get("symbol"),
            scale_code=item["scaleCode"],
            sort_order=item["sortOrder"],
            meaning=item.get("meaning"),
            rationale=item.get("rationale"),
        )
        db.add(flower)
        flowers_by_scale[flower.scale_code] = flower

    db.flush()

    for item in payload["questions"]:
        flower = flowers_by_scale[item["scaleCode"]]
        db.add(
            Question(
                survey_id=survey.id,
                code=item["code"],
                number=item["number"],
                prompt=item["prompt"],
                scale_code=item["scaleCode"],
                flower_code=flower.code,
                sort_order=item["sortOrder"],
                min_value=item["minValue"],
                max_value=item["maxValue"],
                weight=item["weight"],
                is_required=item.get("required", True),
            )
        )

    db.commit()
