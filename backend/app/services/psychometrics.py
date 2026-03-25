from __future__ import annotations

import math


def mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def sample_variance(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    average = mean(values)
    return sum((value - average) ** 2 for value in values) / (len(values) - 1)


def sample_standard_deviation(values: list[float]) -> float | None:
    variance = sample_variance(values)
    if variance is None:
        return None
    return math.sqrt(variance)


def population_variance(values: list[float]) -> float | None:
    if not values:
        return None
    average = mean(values)
    return sum((value - average) ** 2 for value in values) / len(values)


def population_standard_deviation(values: list[float]) -> float | None:
    variance = population_variance(values)
    if variance is None:
        return None
    return math.sqrt(variance)


def pearson_correlation(left: list[float], right: list[float]) -> float | None:
    if len(left) != len(right) or len(left) < 2:
        return None

    left_mean = mean(left)
    right_mean = mean(right)
    left_deltas = [value - left_mean for value in left]
    right_deltas = [value - right_mean for value in right]
    denominator = math.sqrt(sum(delta**2 for delta in left_deltas) * sum(delta**2 for delta in right_deltas))
    if denominator == 0:
        return None
    numerator = sum(left_delta * right_delta for left_delta, right_delta in zip(left_deltas, right_deltas, strict=False))
    return numerator / denominator


def cronbach_alpha(matrix: list[list[float]]) -> float | None:
    if not matrix or len(matrix) < 2:
        return None

    item_count = len(matrix[0])
    if item_count < 2:
        return None

    item_variances: list[float] = []
    for index in range(item_count):
        column = [row[index] for row in matrix]
        variance = sample_variance(column)
        item_variances.append(variance or 0.0)

    total_scores = [sum(row) for row in matrix]
    total_variance = sample_variance(total_scores)
    if total_variance is None or total_variance <= 0:
        return None

    return (item_count / (item_count - 1)) * (1 - (sum(item_variances) / total_variance))


def corrected_item_total_correlation(matrix: list[list[float]], item_index: int) -> float | None:
    if not matrix or len(matrix) < 2:
        return None

    item_values = [row[item_index] for row in matrix]
    total_without_item = [sum(row) - row[item_index] for row in matrix]
    return pearson_correlation(item_values, total_without_item)


def cronbach_alpha_if_item_deleted(matrix: list[list[float]], item_index: int) -> float | None:
    reduced_matrix = [
        [value for index, value in enumerate(row) if index != item_index]
        for row in matrix
    ]
    return cronbach_alpha(reduced_matrix)
