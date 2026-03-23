from __future__ import annotations

import unittest
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.response import ResultRead
from app.services.scoring import (  # noqa: E402
    EXPECTED_QUESTION_COUNT,
    EXPECTED_SCALE_COUNT,
    QUESTIONS_PER_SCALE,
    build_catalog,
    compute_result,
)


class FixedChoiceRng:
    def __init__(self, choice_index: int = 0) -> None:
        self.choice_index = choice_index

    def choice(self, sequence):
        return sequence[self.choice_index]


def build_answers(*, default_value: int = 0, scale_overrides: dict[str, int] | None = None) -> dict[str, int]:
    _, _, _, questions = build_catalog()
    overrides = scale_overrides or {}
    answers: dict[str, int] = {}
    for question in questions.values():
        answers[question["code"]] = overrides.get(question["scaleCode"], default_value)
    return answers


class ComputeResultTests(unittest.TestCase):
    def test_catalog_has_30_questions_and_10_scales_with_3_questions_each(self) -> None:
        _, flowers, scales, questions = build_catalog()

        self.assertEqual(len(questions), EXPECTED_QUESTION_COUNT)
        self.assertEqual(len(scales), EXPECTED_SCALE_COUNT)
        self.assertEqual(len(flowers), EXPECTED_SCALE_COUNT)

        counts_by_scale: dict[str, int] = {scale_code: 0 for scale_code in scales}
        for question in questions.values():
            counts_by_scale[question["scaleCode"]] += 1

        self.assertTrue(all(count == QUESTIONS_PER_SCALE for count in counts_by_scale.values()))

    def test_compute_result_uses_required_formulas(self) -> None:
        answers = build_answers(scale_overrides={"hs": 4})

        result = compute_result(answers)

        self.assertEqual(len(result["scale_scores"]), EXPECTED_SCALE_COUNT)
        self.assertEqual(result["main_flower"]["flower_code"], "lily")
        self.assertEqual(result["main_flower"]["raw_score"], 12)
        self.assertAlmostEqual(result["mean"], 1.2)
        self.assertAlmostEqual(result["standard_deviation"], 3.6)
        self.assertAlmostEqual(result["main_flower"]["z_score"], 3.0)
        self.assertEqual(result["tie_break"]["strategy"], "single_top")
        self.assertFalse(result["tie_break"]["applied"])

    def test_compute_result_rejects_missing_answers(self) -> None:
        answers = build_answers()
        answers.pop("hs_01")

        with self.assertRaisesRegex(ValueError, "missing required answers: hs_01"):
            compute_result(answers)

    def test_compute_result_rejects_answer_out_of_range(self) -> None:
        answers = build_answers()
        answers["hs_01"] = 5

        with self.assertRaisesRegex(ValueError, "answer hs_01 is out of range"):
            compute_result(answers)

    def test_tie_break_uses_random_among_top(self) -> None:
        answers = build_answers(scale_overrides={"hs": 4, "d": 4})

        result = compute_result(answers, rng=FixedChoiceRng(choice_index=1))

        self.assertEqual(result["tie_break"]["strategy"], "random_among_top")
        self.assertTrue(result["tie_break"]["applied"])
        self.assertEqual(result["tie_break"]["candidate_flower_codes"], ["lily", "chrysanthemum"])
        self.assertEqual(result["main_flower"]["flower_code"], "chrysanthemum")
        self.assertAlmostEqual(result["main_flower"]["z_score"], 2.0)

    def test_sd_zero_uses_random_among_all_and_zero_z_scores(self) -> None:
        answers = build_answers(default_value=2)

        result = compute_result(answers, rng=FixedChoiceRng(choice_index=3))

        self.assertEqual(result["tie_break"]["strategy"], "random_among_all")
        self.assertTrue(result["tie_break"]["applied"])
        self.assertEqual(
            result["tie_break"]["candidate_flower_codes"],
            ["lily", "chrysanthemum", "gerbera", "tulip", "rose", "cactus", "cereus", "orchid", "iris", "sunflower"],
        )
        self.assertEqual(result["main_flower"]["flower_code"], "tulip")
        self.assertTrue(all(score["z_score"] == 0.0 for score in result["scale_scores"]))

    def test_result_payload_serializes_for_frontend(self) -> None:
        payload = compute_result(build_answers(scale_overrides={"ma": 4}))
        serialized = ResultRead(
            **payload,
            response_session_id="session-1",
            submitted_at=datetime.now(timezone.utc),
        ).model_dump(mode="json")

        self.assertEqual(serialized["response_session_id"], "session-1")
        self.assertEqual(serialized["main_flower"]["flower_code"], "sunflower")
        self.assertIn("tie_break", serialized)
        self.assertIn("scale_scores", serialized)
        self.assertEqual(len(serialized["scale_scores"]), EXPECTED_SCALE_COUNT)
        self.assertIsInstance(serialized["submitted_at"], str)


if __name__ == "__main__":
    unittest.main()
