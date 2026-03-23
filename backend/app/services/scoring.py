from __future__ import annotations

import math
import random
from collections import Counter, defaultdict

from app.services.seed_service import load_interpretation_seed, load_question_seed

EXPECTED_QUESTION_COUNT = 30
EXPECTED_SCALE_COUNT = 10
QUESTIONS_PER_SCALE = 3
MIN_ANSWER_VALUE = 0
MAX_ANSWER_VALUE = 4


def build_catalog() -> tuple[dict, dict[str, dict], dict[str, dict], dict[str, dict]]:
    payload = load_question_seed()
    survey = payload["survey"]
    flowers = {item["code"]: item for item in payload["flowers"]}
    scales = {item["code"]: item for item in payload["scales"]}
    questions = {item["code"]: item for item in payload["questions"]}
    validate_survey_catalog(flowers=flowers, scales=scales, questions=questions)
    return survey, flowers, scales, questions


def validate_survey_catalog(*, flowers: dict[str, dict], scales: dict[str, dict], questions: dict[str, dict]) -> None:
    if len(questions) != EXPECTED_QUESTION_COUNT:
        raise ValueError(f"survey must contain exactly {EXPECTED_QUESTION_COUNT} questions")

    if len(scales) != EXPECTED_SCALE_COUNT:
        raise ValueError(f"survey must contain exactly {EXPECTED_SCALE_COUNT} scales")

    flowers_by_scale = {item["scaleCode"]: item for item in flowers.values()}
    missing_flower_scales = sorted(set(scales) - set(flowers_by_scale))
    if missing_flower_scales:
        raise ValueError(f"missing flower mapping for scales: {', '.join(missing_flower_scales)}")

    question_counts = Counter()
    for question in questions.values():
        scale_code = question["scaleCode"]
        if scale_code not in scales:
            raise ValueError(f"question references unknown scale: {scale_code}")
        if question.get("minValue") != MIN_ANSWER_VALUE or question.get("maxValue") != MAX_ANSWER_VALUE:
            raise ValueError(f"question {question['code']} must use value range {MIN_ANSWER_VALUE}..{MAX_ANSWER_VALUE}")
        question_counts[scale_code] += 1

    invalid_scales = [
        scale_code
        for scale_code in scales
        if question_counts.get(scale_code, 0) != QUESTIONS_PER_SCALE
    ]
    if invalid_scales:
        raise ValueError(
            f"each scale must contain exactly {QUESTIONS_PER_SCALE} questions: {', '.join(sorted(invalid_scales))}"
        )


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


def _scale_order(scales: dict[str, dict]) -> list[str]:
    return [
        scale_code
        for scale_code, _ in sorted(scales.items(), key=lambda item: (item[1].get("sortOrder", 0), item[0]))
    ]


def compute_result(answers: dict[str, int], rng: random.Random | random.SystemRandom | None = None) -> dict:
    survey, flowers, scales, questions = build_catalog()
    scale_order = _scale_order(scales)
    scale_position = {scale_code: index for index, scale_code in enumerate(scale_order)}
    flowers_by_scale = {item["scaleCode"]: item for item in flowers.values()}
    required_questions = {
        code: question
        for code, question in questions.items()
        if question.get("required", True)
    }

    missing_codes = sorted(set(required_questions) - set(answers))
    if missing_codes:
        raise ValueError(f"missing required answers: {', '.join(missing_codes)}")

    unknown_codes = sorted(set(answers) - set(questions))
    if unknown_codes:
        raise ValueError(f"unknown question code: {', '.join(unknown_codes)}")

    grouped: dict[str, list[int]] = defaultdict(list)
    for question_code, value in answers.items():
        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError(f"answer {question_code} must be an integer")
        if value < MIN_ANSWER_VALUE or value > MAX_ANSWER_VALUE:
            raise ValueError(f"answer {question_code} is out of range")

        question = questions[question_code]
        scale_code = question["scaleCode"]
        grouped[scale_code].append(value)

    invalid_scale_sizes = [
        scale_code
        for scale_code in scale_order
        if len(grouped.get(scale_code, [])) != QUESTIONS_PER_SCALE
    ]
    if invalid_scale_sizes:
        raise ValueError(f"each of the {EXPECTED_SCALE_COUNT} scales must contain exactly {QUESTIONS_PER_SCALE} answers")

    raw_scores = {
        scale_code: sum(grouped[scale_code])
        for scale_code in scale_order
    }
    mean_value = sum(raw_scores.values()) / EXPECTED_SCALE_COUNT
    standard_deviation = math.sqrt(
        sum((raw_scores[scale_code] - mean_value) ** 2 for scale_code in scale_order) / EXPECTED_SCALE_COUNT
    )

    active_rng = rng or random.SystemRandom()

    if standard_deviation == 0:
        z_scores = {scale_code: 0.0 for scale_code in scale_order}
        candidate_scale_codes = list(scale_order)
        selected_scale_code = active_rng.choice(candidate_scale_codes)
        tie_break_strategy = "random_among_all"
        tie_break_applied = True
    else:
        z_scores = {
            scale_code: (raw_scores[scale_code] - mean_value) / standard_deviation
            for scale_code in scale_order
        }
        max_z_score = max(z_scores.values())
        candidate_scale_codes = [
            scale_code
            for scale_code in scale_order
            if math.isclose(z_scores[scale_code], max_z_score, rel_tol=0, abs_tol=1e-9)
        ]
        if len(candidate_scale_codes) > 1:
            selected_scale_code = active_rng.choice(candidate_scale_codes)
            tie_break_strategy = "random_among_top"
            tie_break_applied = True
        else:
            selected_scale_code = candidate_scale_codes[0]
            tie_break_strategy = "single_top"
            tie_break_applied = False

    interpretation_seed = load_interpretation_seed()
    score_rows: list[dict] = []
    for rank, scale_code in enumerate(
        sorted(
            scale_order,
            key=lambda item: (-z_scores[item], -raw_scores[item], scale_position[item]),
        ),
        start=1,
    ):
        flower = flowers_by_scale[scale_code]
        z_level_code, z_level_title = _find_z_level(z_scores[scale_code], interpretation_seed)
        score_rows.append(
            {
                "scale_code": scale_code,
                "flower_code": flower["code"],
                "flower_title": flower["title"],
                "flower_symbol": flower.get("symbol"),
                "raw_score": raw_scores[scale_code],
                "z_score": round(z_scores[scale_code], 4),
                "rank": rank,
                "z_level_code": z_level_code,
                "z_level_title": z_level_title,
            }
        )

    main_row = next(row for row in score_rows if row["scale_code"] == selected_scale_code)
    candidate_flower_codes = [flowers_by_scale[scale_code]["code"] for scale_code in candidate_scale_codes]

    return {
        "survey_code": survey["code"],
        "survey_version": survey["version"],
        "algorithm_version": survey["algorithmVersion"],
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
            "candidate_flower_codes": candidate_flower_codes,
        },
        "scale_scores": score_rows,
        "interpretation": _build_interpretation(main_row["flower_code"], z_scores[selected_scale_code]),
    }
