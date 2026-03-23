from __future__ import annotations

import math
import random

from app.services.seed_service import load_interpretation_seed, load_question_seed


def build_catalog() -> tuple[dict[str, dict], dict[str, dict]]:
    payload = load_question_seed()
    flowers = {item["code"]: item for item in payload["flowers"]}
    questions = {item["code"]: item for item in payload["questions"]}
    return flowers, questions


def _find_z_level(z_score: float, interpretation_seed: dict) -> tuple[str | None, str | None]:
    scaled_value = round(z_score * interpretation_seed.get("zScaleFactor", 10))
    for z_level in interpretation_seed["zLevels"]:
        if z_level["zFrom"] <= scaled_value <= z_level["zTo"]:
            return z_level["code"], z_level["title"]
    return None, None


def _build_interpretation(main_flower_code: str, main_z_score: float) -> dict:
    interpretation_seed = load_interpretation_seed()
    z_level_code, z_level_title = _find_z_level(main_z_score, interpretation_seed)
    profile = next(
        (item for item in interpretation_seed["profiles"] if item["flowerCode"] == main_flower_code),
        None,
    )
    if not profile:
        return {
            "z_level_code": z_level_code,
            "z_level_title": z_level_title,
            "profile_title": None,
            "profile_summary": None,
            "profile_source_header": None,
            "z_summary": None,
            "traits": [],
        }

    z_interpretation = next(
        (item for item in profile["zInterpretations"] if item["zLevelCode"] == z_level_code),
        None,
    )

    return {
        "z_level_code": z_level_code,
        "z_level_title": z_level_title,
        "profile_title": profile["profileInterpretation"]["title"],
        "profile_summary": profile["profileInterpretation"]["summary"],
        "profile_source_header": profile["profileInterpretation"]["narrative"]["sourceHeader"],
        "z_summary": z_interpretation["summary"] if z_interpretation else None,
        "traits": profile.get("traits", []),
    }


def compute_result(answers: dict[str, int]) -> dict:
    flowers, questions = build_catalog()
    missing_codes = sorted(set(questions) - set(answers))
    if missing_codes:
        raise ValueError(f"missing required answers: {', '.join(missing_codes)}")

    grouped: dict[str, list[int]] = {}
    for question_code, value in answers.items():
        if question_code not in questions:
            raise ValueError(f"unknown question code: {question_code}")
        if value < 0 or value > 4:
            raise ValueError(f"answer {question_code} is out of range")
        scale_code = questions[question_code]["scaleCode"]
        grouped.setdefault(scale_code, []).append(value)

    if len(grouped) != 10 or any(len(values) != 3 for values in grouped.values()):
        raise ValueError("each of the 10 scales must contain exactly 3 answers")

    raw_scores = {scale_code: sum(values) for scale_code, values in grouped.items()}
    mean_value = sum(raw_scores.values()) / len(raw_scores)
    variance = sum((score - mean_value) ** 2 for score in raw_scores.values()) / len(raw_scores)
    standard_deviation = math.sqrt(variance)

    score_rows: list[dict] = []
    rng = random.SystemRandom()

    if standard_deviation == 0:
        z_scores = {scale_code: 0.0 for scale_code in raw_scores}
        candidate_scale_codes = sorted(raw_scores)
        selected_scale_code = rng.choice(candidate_scale_codes)
        tie_break_strategy = "random_among_all"
        tie_break_applied = True
    else:
        z_scores = {
            scale_code: (raw_score - mean_value) / standard_deviation
            for scale_code, raw_score in raw_scores.items()
        }
        max_z_score = max(z_scores.values())
        candidate_scale_codes = sorted(
            scale_code
            for scale_code, z_score in z_scores.items()
            if math.isclose(z_score, max_z_score, rel_tol=0, abs_tol=1e-9)
        )
        if len(candidate_scale_codes) > 1:
            selected_scale_code = rng.choice(candidate_scale_codes)
            tie_break_strategy = "random_among_top"
            tie_break_applied = True
        else:
            selected_scale_code = candidate_scale_codes[0]
            tie_break_strategy = "single_top"
            tie_break_applied = False

    interpretation_seed = load_interpretation_seed()
    for index, (scale_code, raw_score) in enumerate(
        sorted(raw_scores.items(), key=lambda item: (-z_scores[item[0]], -item[1], item[0])),
        start=1,
    ):
        flower = next(item for item in flowers.values() if item["scaleCode"] == scale_code)
        z_level_code, z_level_title = _find_z_level(z_scores[scale_code], interpretation_seed)
        score_rows.append(
            {
                "scale_code": scale_code,
                "flower_code": flower["code"],
                "flower_title": flower["title"],
                "flower_symbol": flower.get("symbol"),
                "raw_score": raw_score,
                "z_score": round(z_scores[scale_code], 4),
                "rank": index,
                "z_level_code": z_level_code,
                "z_level_title": z_level_title,
            }
        )

    main_row = next(row for row in score_rows if row["scale_code"] == selected_scale_code)

    return {
        "survey_code": load_question_seed()["survey"]["code"],
        "survey_version": load_question_seed()["survey"]["version"],
        "algorithm_version": load_question_seed()["survey"]["algorithmVersion"],
        "mean": round(mean_value, 4),
        "standard_deviation": round(standard_deviation, 4),
        "main_flower": {
            "scale_code": main_row["scale_code"],
            "flower_code": main_row["flower_code"],
            "flower_title": main_row["flower_title"],
            "flower_symbol": main_row["flower_symbol"],
            "raw_score": main_row["raw_score"],
            "z_score": main_row["z_score"],
        },
        "tie_break": {
            "applied": tie_break_applied,
            "strategy": tie_break_strategy,
            "candidate_flower_codes": [
                next(item for item in flowers.values() if item["scaleCode"] == scale_code)["code"]
                for scale_code in candidate_scale_codes
            ],
        },
        "scale_scores": score_rows,
        "interpretation": _build_interpretation(main_row["flower_code"], main_row["z_score"]),
    }
