from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.survey import Flower, FlowerInterpretation, FlowerTrait, Question, Survey, SurveyScale
from app.models.user import User


@lru_cache
def load_question_seed() -> dict:
    settings = get_settings()
    return json.loads(Path(settings.seeds_dir, "questions.v1.json").read_text(encoding="utf-8"))


@lru_cache
def load_interpretation_seed() -> dict:
    settings = get_settings()
    return json.loads(Path(settings.seeds_dir, "interps.v1.json").read_text(encoding="utf-8"))


def ensure_seed_data(db: Session) -> None:
    _ensure_test_admin(db)

    question_payload = load_question_seed()
    interpretation_payload = load_interpretation_seed()
    survey_meta = question_payload["survey"]

    survey = db.scalar(
        select(Survey).where(
            Survey.code == survey_meta["code"],
            Survey.version == survey_meta["version"],
        )
    )
    if not survey:
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

    existing_flowers = {
        flower.code: flower
        for flower in db.scalars(select(Flower).where(Flower.survey_id == survey.id)).all()
    }
    flowers_by_scale: dict[str, Flower] = {flower.scale_code: flower for flower in existing_flowers.values()}
    for item in question_payload["flowers"]:
        flower = existing_flowers.get(item["code"])
        if not flower:
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
            existing_flowers[flower.code] = flower
        flowers_by_scale[item["scaleCode"]] = flower

    db.flush()

    existing_scales = {
        scale.code: scale
        for scale in db.scalars(select(SurveyScale).where(SurveyScale.survey_id == survey.id)).all()
    }
    for item in question_payload["scales"]:
        if item["code"] in existing_scales:
            continue
        db.add(
            SurveyScale(
                survey_id=survey.id,
                code=item["code"],
                title=item["title"],
                short_code=item["shortCode"],
                flower_code=item["flowerCode"],
                min_score=item["minScore"],
                max_score=item["maxScore"],
                sort_order=item["sortOrder"],
                seed_payload=item.get("metadata"),
            )
        )

    existing_questions = {
        question.code: question
        for question in db.scalars(select(Question).where(Question.survey_id == survey.id)).all()
    }
    for item in question_payload["questions"]:
        if item["code"] in existing_questions:
            continue
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

    existing_interpretations = {
        (item.flower_code, item.entry_key): item
        for item in db.scalars(select(FlowerInterpretation).where(FlowerInterpretation.survey_id == survey.id)).all()
    }
    existing_traits = {
        (item.flower_code, item.code): item
        for item in db.scalars(select(FlowerTrait).where(FlowerTrait.survey_id == survey.id)).all()
    }
    for profile in interpretation_payload["profiles"]:
        flower_code = profile["flowerCode"]
        profile_block = profile["profileInterpretation"]
        profile_key = (flower_code, "profile")
        if profile_key not in existing_interpretations:
            db.add(
                FlowerInterpretation(
                    survey_id=survey.id,
                    flower_code=flower_code,
                    entry_key="profile",
                    entry_type="profile",
                    z_level_code=None,
                    title=profile_block["title"],
                    summary=profile_block["summary"],
                    source_header=profile_block.get("narrative", {}).get("sourceHeader"),
                    source_range=None,
                    sort_order=0,
                )
            )

        for entry in profile["zInterpretations"]:
            entry_key = (flower_code, entry["zLevelCode"])
            if entry_key in existing_interpretations:
                continue
            db.add(
                FlowerInterpretation(
                    survey_id=survey.id,
                    flower_code=flower_code,
                    entry_key=entry["zLevelCode"],
                    entry_type="z_level",
                    z_level_code=entry["zLevelCode"],
                    title=entry["title"],
                    summary=entry["summary"],
                    source_header=None,
                    source_range=entry.get("sourceRange"),
                    sort_order=entry["sortOrder"],
                )
            )

        for trait in profile.get("traits", []):
            trait_key = (flower_code, trait["code"])
            if trait_key in existing_traits:
                continue
            db.add(
                FlowerTrait(
                    survey_id=survey.id,
                    flower_code=flower_code,
                    code=trait["code"],
                    label=trait["label"],
                    description=trait["description"],
                    polarity=trait["polarity"],
                    sort_order=trait["sortOrder"],
                )
            )

    db.commit()


def _ensure_test_admin(db: Session) -> None:
    settings = get_settings()
    if not settings.test_admin_enabled:
        return

    username = settings.test_admin_username.strip().lower()
    if not username:
        return

    existing_user = db.scalar(select(User).where(User.username == username))
    password_hash = hash_password(settings.test_admin_password)

    if existing_user:
        existing_user.password_hash = password_hash
        existing_user.is_guest = False
        existing_user.role = "admin"
        db.flush()
        return

    db.add(
        User(
            username=username,
            password_hash=password_hash,
            is_guest=False,
            role="admin",
        )
    )
    db.flush()
