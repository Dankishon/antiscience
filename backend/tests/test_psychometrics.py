from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.psychometrics import (  # noqa: E402
    corrected_item_total_correlation,
    cronbach_alpha,
    cronbach_alpha_if_item_deleted,
    mean,
    sample_standard_deviation,
    sample_variance,
)


class PsychometricsTests(unittest.TestCase):
    def test_basic_statistics_use_sample_formulas(self) -> None:
        values = [1.0, 2.0, 3.0, 4.0]

        self.assertAlmostEqual(mean(values), 2.5)
        self.assertAlmostEqual(sample_variance(values) or 0.0, 1.6666666667, places=6)
        self.assertAlmostEqual(sample_standard_deviation(values) or 0.0, 1.2909944487, places=6)

    def test_cronbach_alpha_and_item_statistics_match_expected_values(self) -> None:
        matrix = [
            [1.0, 2.0, 3.0],
            [2.0, 3.0, 4.0],
            [3.0, 4.0, 4.0],
            [4.0, 4.0, 5.0],
        ]

        self.assertAlmostEqual(cronbach_alpha(matrix) or 0.0, 0.9532710280, places=6)
        self.assertAlmostEqual(corrected_item_total_correlation(matrix, 0) or 0.0, 0.9827076298, places=6)
        self.assertAlmostEqual(corrected_item_total_correlation(matrix, 1) or 0.0, 0.9198662110, places=6)
        self.assertAlmostEqual(corrected_item_total_correlation(matrix, 2) or 0.0, 0.9205746179, places=6)
        self.assertAlmostEqual(cronbach_alpha_if_item_deleted(matrix, 0) or 0.0, 0.9142857143, places=6)
        self.assertAlmostEqual(cronbach_alpha_if_item_deleted(matrix, 1) or 0.0, 0.9230769231, places=6)
        self.assertAlmostEqual(cronbach_alpha_if_item_deleted(matrix, 2) or 0.0, 0.9491525424, places=6)

    def test_cronbach_alpha_returns_none_for_insufficient_or_flat_data(self) -> None:
        self.assertIsNone(cronbach_alpha([[1.0, 1.0, 1.0]]))
        self.assertIsNone(cronbach_alpha([[2.0, 2.0], [2.0, 2.0]]))
        self.assertIsNone(corrected_item_total_correlation([[1.0, 1.0], [1.0, 1.0]], 0))


if __name__ == "__main__":
    unittest.main()
