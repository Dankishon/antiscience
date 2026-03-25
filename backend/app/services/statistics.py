from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.response import ResponseSession
from app.models.survey import Flower, Question, Survey, SurveyScale
from app.schemas.statistics import (
    StatisticsClusterAssignmentRead,
    StatisticsClusterProfilePointRead,
    StatisticsClusterRead,
    StatisticsClustersRead,
    StatisticsCorrelationRowRead,
    StatisticsCorrelationValueRead,
    StatisticsFactorAnalysisRead,
    StatisticsFactorLoadingRead,
    StatisticsOverviewRead,
    StatisticsPayloadRead,
    StatisticsPcaComponentRead,
    StatisticsReliabilityItemRead,
    StatisticsReliabilityRead,
    StatisticsReliabilityScaleRead,
    StatisticsRespondentProfileRead,
    StatisticsScaleSummaryRead,
)
from app.services.analytics import (
    _active_survey,
    _ordered_questions,
    _ordered_scales,
    _question_lookup,
    _raw_score_map,
    _respondent_label,
    _round,
    _scale_lookup,
    _submitted_sessions_query,
)
from app.services.psychometrics import (
    corrected_item_total_correlation,
    cronbach_alpha,
    cronbach_alpha_if_item_deleted,
    mean,
    pearson_correlation,
    population_standard_deviation,
    sample_standard_deviation,
    sample_variance,
)

MIN_OVERVIEW_RESPONDENTS = 2
MIN_FACTOR_ANALYSIS_RESPONDENTS = 5
MIN_CLUSTER_RESPONDENTS = 4
KMEANS_MAX_CLUSTERS = 6
KMEANS_RANDOM_SEED = 42
KMEANS_MAX_ITER = 100
KMEANS_N_INIT = 12


@dataclass
class ScaleSampleStats:
    mean_raw: float
    standard_deviation_raw: float
    min_raw: float
    max_raw: float
    respondents_count: int


@dataclass
class RespondentStatisticsRow:
    session_id: str
    respondent_label: str
    raw_scores_by_scale: dict[str, int]
    external_z_scores_by_scale: dict[str, float] = field(default_factory=dict)


def _zero_external_z_message() -> str:
    return "Недостаточно завершённых прохождений для устойчивого внешнего нормирования."


def _empty_overview() -> StatisticsOverviewRead:
    return StatisticsOverviewRead(
        insufficient_data=True,
        message=_zero_external_z_message(),
        respondents_count=0,
        scales=[],
        respondents=[],
    )


def _empty_reliability() -> StatisticsReliabilityRead:
    return StatisticsReliabilityRead(
        insufficient_data=True,
        message="Недостаточно данных для расчёта надёжности.",
        scales=[],
        items=[],
    )


def _empty_factor_analysis(message: str) -> StatisticsFactorAnalysisRead:
    return StatisticsFactorAnalysisRead(
        insufficient_data=True,
        message=message,
        respondents_count=0,
        recommended_components=None,
        included_scale_codes=[],
        excluded_scale_codes=[],
        components=[],
        correlation_matrix=[],
        loadings=[],
    )


def _empty_clusters(message: str) -> StatisticsClustersRead:
    return StatisticsClustersRead(
        insufficient_data=True,
        message=message,
        respondents_count=0,
        cluster_count=0,
        silhouette_score=None,
        clusters=[],
        assignments=[],
    )


def _flower_lookup(db: Session, survey: Survey | None) -> dict[str, Flower]:
    if not survey:
        return {}
    flowers = db.scalars(select(Flower).where(Flower.survey_id == survey.id)).all()
    return {flower.code: flower for flower in flowers}


def _collect_statistics_context(
    db: Session,
) -> tuple[
    Survey | None,
    list[SurveyScale],
    dict[str, SurveyScale],
    list[Question],
    dict[str, Question],
    dict[str, Flower],
    list[ResponseSession],
    list[RespondentStatisticsRow],
    dict[str, ScaleSampleStats],
]:
    survey = _active_survey(db)
    ordered_scales = _ordered_scales(survey)
    scale_by_code = _scale_lookup(survey)
    ordered_questions = _ordered_questions(survey)
    question_by_code = _question_lookup(survey)
    flower_by_code = _flower_lookup(db, survey)

    if not survey:
        return survey, [], {}, [], {}, flower_by_code, [], [], {}

    sessions = db.scalars(
        _submitted_sessions_query().where(ResponseSession.survey_id == survey.id)
    ).all()

    respondents: list[RespondentStatisticsRow] = []
    for response_session in sessions:
        raw_scores = _raw_score_map(
            response_session,
            question_by_code=question_by_code,
            scale_by_code=scale_by_code,
        )
        respondents.append(
            RespondentStatisticsRow(
                session_id=response_session.id,
                respondent_label=_respondent_label(response_session.user),
                raw_scores_by_scale={scale.code: raw_scores.get(scale.code, 0) for scale in ordered_scales},
            )
        )

    sample_stats: dict[str, ScaleSampleStats] = {}
    for scale in ordered_scales:
        values = [float(row.raw_scores_by_scale.get(scale.code, 0)) for row in respondents]
        sample_stats[scale.code] = ScaleSampleStats(
            mean_raw=mean(values),
            standard_deviation_raw=population_standard_deviation(values) or 0.0,
            min_raw=min(values) if values else 0.0,
            max_raw=max(values) if values else 0.0,
            respondents_count=len(values),
        )

    for respondent in respondents:
        respondent.external_z_scores_by_scale = {
            scale.code: _round(
                (
                    (respondent.raw_scores_by_scale.get(scale.code, 0) - sample_stats[scale.code].mean_raw)
                    / sample_stats[scale.code].standard_deviation_raw
                )
                if sample_stats[scale.code].standard_deviation_raw > 0
                else 0.0
            )
            or 0.0
            for scale in ordered_scales
        }

    return (
        survey,
        ordered_scales,
        scale_by_code,
        ordered_questions,
        question_by_code,
        flower_by_code,
        sessions,
        respondents,
        sample_stats,
    )


def _alpha_interpretation(alpha: float | None) -> str:
    if alpha is None:
        return "Недостаточно данных"
    if alpha >= 0.9:
        return "Отлично"
    if alpha >= 0.8:
        return "Хорошо"
    if alpha >= 0.7:
        return "Приемлемо"
    return "Слабо"


def _pairwise_scale_correlation(
    respondents: list[RespondentStatisticsRow],
    left_scale_code: str,
    right_scale_code: str,
) -> float:
    left_values = [row.external_z_scores_by_scale[left_scale_code] for row in respondents]
    right_values = [row.external_z_scores_by_scale[right_scale_code] for row in respondents]
    if left_scale_code == right_scale_code:
        return 1.0 if left_values else 0.0

    correlation = pearson_correlation(left_values, right_values)
    return _round(correlation) or 0.0


def _build_correlation_matrix(
    ordered_scales: list[SurveyScale],
    respondents: list[RespondentStatisticsRow],
) -> list[StatisticsCorrelationRowRead]:
    return [
        StatisticsCorrelationRowRead(
            scale_code=left_scale.code,
            scale_name=left_scale.title,
            values=[
                StatisticsCorrelationValueRead(
                    scale_code=right_scale.code,
                    scale_name=right_scale.title,
                    value=_pairwise_scale_correlation(respondents, left_scale.code, right_scale.code),
                )
                for right_scale in ordered_scales
            ],
        )
        for left_scale in ordered_scales
    ]


def _has_distinct_rows(matrix: np.ndarray) -> bool:
    if matrix.size == 0:
        return False
    unique_rows = np.unique(np.round(matrix, 8), axis=0)
    return len(unique_rows) >= 2


def _kmeans_single_run(
    matrix: np.ndarray,
    *,
    cluster_count: int,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray, float] | None:
    row_count = len(matrix)
    if cluster_count < 2 or row_count < cluster_count:
        return None

    unique_indices = np.unique(np.round(matrix, 8), axis=0, return_index=True)[1]
    if len(unique_indices) < cluster_count:
        return None

    centroid_indices = rng.choice(unique_indices, size=cluster_count, replace=False)
    centroids = matrix[centroid_indices].copy()
    labels = np.zeros(row_count, dtype=int)

    for _ in range(KMEANS_MAX_ITER):
        distances = np.linalg.norm(matrix[:, None, :] - centroids[None, :, :], axis=2)
        next_labels = distances.argmin(axis=1)

        next_centroids = centroids.copy()
        for cluster_index in range(cluster_count):
            members = matrix[next_labels == cluster_index]
            if len(members) == 0:
                farthest_index = int(np.argmax(distances.min(axis=1)))
                next_centroids[cluster_index] = matrix[farthest_index]
            else:
                next_centroids[cluster_index] = members.mean(axis=0)

        if np.array_equal(next_labels, labels) and np.allclose(next_centroids, centroids):
            labels = next_labels
            centroids = next_centroids
            break

        labels = next_labels
        centroids = next_centroids

    inertia = float(np.sum((matrix - centroids[labels]) ** 2))
    return labels, centroids, inertia


def _silhouette_score(matrix: np.ndarray, labels: np.ndarray) -> float | None:
    row_count = len(matrix)
    unique_labels = np.unique(labels)
    if row_count < 2 or len(unique_labels) < 2:
        return None

    distance_matrix = np.linalg.norm(matrix[:, None, :] - matrix[None, :, :], axis=2)
    scores: list[float] = []
    for index in range(row_count):
        same_cluster = labels == labels[index]
        same_cluster[index] = False
        intra_distances = distance_matrix[index, same_cluster]
        a_score = float(np.mean(intra_distances)) if intra_distances.size > 0 else 0.0

        b_candidates: list[float] = []
        for cluster_label in unique_labels:
            if cluster_label == labels[index]:
                continue
            other_distances = distance_matrix[index, labels == cluster_label]
            if other_distances.size > 0:
                b_candidates.append(float(np.mean(other_distances)))

        if not b_candidates:
            scores.append(0.0)
            continue

        b_score = min(b_candidates)
        denominator = max(a_score, b_score)
        scores.append((b_score - a_score) / denominator if denominator > 0 else 0.0)

    return float(np.mean(scores)) if scores else None


def _choose_best_clusters(matrix: np.ndarray) -> tuple[np.ndarray, float | None] | None:
    row_count = len(matrix)
    max_clusters = min(KMEANS_MAX_CLUSTERS, row_count - 1, len(np.unique(np.round(matrix, 8), axis=0)))
    if row_count < MIN_CLUSTER_RESPONDENTS or max_clusters < 2:
        return None

    best_result: tuple[np.ndarray, float | None, float] | None = None
    for cluster_count in range(2, max_clusters + 1):
        for run_index in range(KMEANS_N_INIT):
            rng = np.random.default_rng(KMEANS_RANDOM_SEED + cluster_count * 100 + run_index)
            result = _kmeans_single_run(matrix, cluster_count=cluster_count, rng=rng)
            if result is None:
                continue

            labels, _centroids, inertia = result
            silhouette = _silhouette_score(matrix, labels)
            if silhouette is None:
                continue

            if best_result is None:
                best_result = (labels, silhouette, inertia)
                continue

            _, best_silhouette, best_inertia = best_result
            if silhouette > best_silhouette + 1e-9 or (
                abs(silhouette - best_silhouette) <= 1e-9 and inertia < best_inertia
            ):
                best_result = (labels, silhouette, inertia)

    if best_result is None:
        return None

    labels, silhouette, _ = best_result
    return labels, silhouette


def collect_statistics_payload(db: Session) -> StatisticsPayloadRead:
    (
        survey,
        ordered_scales,
        scale_by_code,
        ordered_questions,
        _question_by_code,
        flower_by_code,
        sessions,
        respondents,
        sample_stats,
    ) = _collect_statistics_context(db)

    if not survey or not ordered_scales:
        return StatisticsPayloadRead(
            overview=_empty_overview(),
            reliability=_empty_reliability(),
            factor_analysis=_empty_factor_analysis("Активный опросник не найден."),
            clusters=_empty_clusters("Активный опросник не найден."),
        )

    respondents_count = len(respondents)

    overview_message = None
    if respondents_count < MIN_OVERVIEW_RESPONDENTS:
        overview_message = _zero_external_z_message()

    overview = StatisticsOverviewRead(
        insufficient_data=respondents_count < MIN_OVERVIEW_RESPONDENTS,
        message=overview_message,
        respondents_count=respondents_count,
        scales=[
            StatisticsScaleSummaryRead(
                scale_code=scale.code,
                scale_name=scale.title,
                short_code=scale.short_code,
                flower_code=scale.flower_code,
                flower_title=flower_by_code[scale.flower_code].title if scale.flower_code in flower_by_code else scale.title,
                flower_symbol=flower_by_code[scale.flower_code].symbol if scale.flower_code in flower_by_code else None,
                sample_mean_raw=_round(sample_stats[scale.code].mean_raw) or 0.0,
                sample_standard_deviation_raw=_round(sample_stats[scale.code].standard_deviation_raw) or 0.0,
                min_raw=_round(sample_stats[scale.code].min_raw) or 0.0,
                max_raw=_round(sample_stats[scale.code].max_raw) or 0.0,
                respondents_count=sample_stats[scale.code].respondents_count,
            )
            for scale in ordered_scales
        ],
        respondents=[
            StatisticsRespondentProfileRead(
                session_id=row.session_id,
                respondent_label=row.respondent_label,
                raw_scores_by_scale=row.raw_scores_by_scale,
                external_z_scores_by_scale=row.external_z_scores_by_scale,
            )
            for row in respondents
        ],
    )

    reliability_scales: list[StatisticsReliabilityScaleRead] = []
    reliability_items: list[StatisticsReliabilityItemRead] = []
    for scale in ordered_scales:
        questions = _ordered_questions(survey, scale_code=scale.code)
        complete_matrix: list[list[float]] = []
        for response_session in sessions:
            answers_by_question_code = {answer.question_code: answer for answer in response_session.answers}
            row: list[float] = []
            complete = True
            for question in questions:
                answer = answers_by_question_code.get(question.code)
                if answer is None:
                    complete = False
                    break
                row.append(float(answer.value))
            if complete:
                complete_matrix.append(row)

        alpha_value = cronbach_alpha(complete_matrix)
        reliability_scales.append(
            StatisticsReliabilityScaleRead(
                scale_code=scale.code,
                scale_name=scale.title,
                short_code=scale.short_code,
                flower_code=scale.flower_code,
                flower_title=flower_by_code[scale.flower_code].title if scale.flower_code in flower_by_code else scale.title,
                flower_symbol=flower_by_code[scale.flower_code].symbol if scale.flower_code in flower_by_code else None,
                cronbach_alpha=_round(alpha_value),
                interpretation=_alpha_interpretation(alpha_value),
                questions_count=len(questions),
                respondents_count=len(complete_matrix),
            )
        )

        for question_index, question in enumerate(questions):
            column = [row[question_index] for row in complete_matrix]
            reliability_items.append(
                StatisticsReliabilityItemRead(
                    scale_code=scale.code,
                    scale_name=scale.title,
                    question_id=question.id,
                    question_code=question.code,
                    question_order=question.number,
                    question_text=question.prompt,
                    mean=_round(mean(column)) or 0.0,
                    variance=_round(sample_variance(column)) or 0.0,
                    standard_deviation=_round(sample_standard_deviation(column)) or 0.0,
                    item_total_correlation=_round(corrected_item_total_correlation(complete_matrix, question_index)),
                    alpha_if_deleted=_round(cronbach_alpha_if_item_deleted(complete_matrix, question_index)),
                )
            )

    reliability = StatisticsReliabilityRead(
        insufficient_data=not any(scale.cronbach_alpha is not None for scale in reliability_scales),
        message=(
            "Недостаточно данных для расчёта надёжности. Нужны минимум два завершённых прохождения с полными ответами по шкале."
            if not any(scale.cronbach_alpha is not None for scale in reliability_scales)
            else None
        ),
        scales=reliability_scales,
        items=reliability_items,
    )

    correlation_matrix = _build_correlation_matrix(ordered_scales, respondents)
    factor_message: str | None = None
    factor_components: list[StatisticsPcaComponentRead] = []
    factor_loadings: list[StatisticsFactorLoadingRead] = []
    included_scale_codes = [
        scale.code for scale in ordered_scales if sample_stats[scale.code].standard_deviation_raw > 0
    ]
    excluded_scale_codes = [
        scale.code for scale in ordered_scales if scale.code not in included_scale_codes
    ]
    recommended_components: int | None = None
    factor_insufficient = False

    factor_matrix = np.asarray(
        [
            [row.external_z_scores_by_scale[scale_code] for scale_code in included_scale_codes]
            for row in respondents
        ],
        dtype=float,
    ) if included_scale_codes else np.empty((0, 0), dtype=float)

    if respondents_count < MIN_FACTOR_ANALYSIS_RESPONDENTS:
        factor_insufficient = True
        factor_message = "Недостаточно завершённых прохождений для устойчивого факторного анализа."
    elif len(included_scale_codes) < 2:
        factor_insufficient = True
        factor_message = "Недостаточно вариативности по шкалам: для PCA нужны минимум две шкалы с ненулевой дисперсией."
    elif factor_matrix.ndim != 2 or factor_matrix.shape[0] < 2 or not _has_distinct_rows(factor_matrix):
        factor_insufficient = True
        factor_message = "Недостаточно данных для устойчивого факторного анализа."
    else:
        correlation = np.corrcoef(factor_matrix, rowvar=False)
        correlation = np.atleast_2d(correlation)
        eigenvalues, eigenvectors = np.linalg.eigh(correlation)
        sort_order = np.argsort(eigenvalues)[::-1]
        eigenvalues = np.maximum(eigenvalues[sort_order], 0.0)
        eigenvectors = eigenvectors[:, sort_order]
        total_eigenvalue = float(np.sum(eigenvalues))

        explained_ratios = (
            eigenvalues / total_eigenvalue
            if total_eigenvalue > 0
            else np.zeros_like(eigenvalues)
        )
        cumulative = np.cumsum(explained_ratios)
        recommended_components = int(np.sum(eigenvalues > 1.0 + 1e-9))
        recommended_components = min(max(recommended_components, 1), 4, len(included_scale_codes))

        factor_components = [
            StatisticsPcaComponentRead(
                component_key=f"PC{index + 1}",
                component_index=index + 1,
                eigenvalue=_round(float(eigenvalue)) or 0.0,
                explained_variance_ratio=_round(float(explained_ratios[index])) or 0.0,
                cumulative_explained_variance_ratio=_round(float(cumulative[index])) or 0.0,
            )
            for index, eigenvalue in enumerate(eigenvalues)
        ]

        loading_matrix = eigenvectors[:, :recommended_components] * np.sqrt(eigenvalues[:recommended_components])
        loading_map = {
            scale_code: [
                _round(float(value))
                for value in loading_matrix[index].tolist()
            ]
            for index, scale_code in enumerate(included_scale_codes)
        }
        factor_loadings = [
            StatisticsFactorLoadingRead(
                scale_code=scale.code,
                scale_name=scale.title,
                short_code=scale.short_code,
                loadings=loading_map.get(scale.code, [None] * recommended_components),
            )
            for scale in ordered_scales
        ]

    factor_analysis = StatisticsFactorAnalysisRead(
        insufficient_data=factor_insufficient,
        message=factor_message,
        respondents_count=respondents_count,
        recommended_components=recommended_components,
        included_scale_codes=included_scale_codes,
        excluded_scale_codes=excluded_scale_codes,
        components=factor_components,
        correlation_matrix=correlation_matrix,
        loadings=factor_loadings,
    )

    cluster_message: str | None = None
    clusters_insufficient = False
    silhouette_score: float | None = None
    clusters: list[StatisticsClusterRead] = []
    assignments: list[StatisticsClusterAssignmentRead] = []

    cluster_matrix = np.asarray(
        [
            [row.external_z_scores_by_scale[scale.code] for scale in ordered_scales]
            for row in respondents
        ],
        dtype=float,
    ) if ordered_scales else np.empty((0, 0), dtype=float)

    if respondents_count < MIN_CLUSTER_RESPONDENTS:
        clusters_insufficient = True
        cluster_message = "Недостаточно завершённых прохождений для устойчивой кластеризации профилей."
    elif cluster_matrix.ndim != 2 or cluster_matrix.shape[0] < 2 or not _has_distinct_rows(cluster_matrix):
        clusters_insufficient = True
        cluster_message = "Недостаточно вариативности профилей для кластерного анализа."
    else:
        cluster_result = _choose_best_clusters(cluster_matrix)
        if cluster_result is None:
            clusters_insufficient = True
            cluster_message = "Не удалось подобрать устойчивую кластерную структуру для текущей выборки."
        else:
            raw_labels, silhouette_score = cluster_result
            ordered_cluster_labels = sorted(
                np.unique(raw_labels).tolist(),
                key=lambda label: (-int(np.sum(raw_labels == label)), int(label)),
            )
            label_mapping = {old_label: new_index for new_index, old_label in enumerate(ordered_cluster_labels)}
            remapped_labels = np.asarray([label_mapping[int(label)] for label in raw_labels], dtype=int)

            for cluster_index in sorted(np.unique(remapped_labels).tolist()):
                member_indices = np.where(remapped_labels == cluster_index)[0]
                member_rows = [respondents[index] for index in member_indices]
                profile = [
                    StatisticsClusterProfilePointRead(
                        scale_code=scale.code,
                        scale_name=scale.title,
                        short_code=scale.short_code,
                        mean_raw_score=_round(
                            mean([row.raw_scores_by_scale.get(scale.code, 0) for row in member_rows])
                        ) or 0.0,
                        mean_external_z_score=_round(
                            mean([row.external_z_scores_by_scale.get(scale.code, 0.0) for row in member_rows])
                        ) or 0.0,
                    )
                    for scale in ordered_scales
                ]
                dominant_flowers = [
                    (
                        flower_by_code[scale_by_code[point.scale_code].flower_code].title
                        if scale_by_code[point.scale_code].flower_code in flower_by_code
                        else point.scale_name
                    )
                    for point in sorted(profile, key=lambda item: (-item.mean_external_z_score, -item.mean_raw_score, item.scale_code))[:3]
                ]
                cluster_id = f"cluster_{cluster_index + 1}"
                cluster_label = f"Кластер {cluster_index + 1}"
                clusters.append(
                    StatisticsClusterRead(
                        cluster_id=cluster_id,
                        label=cluster_label,
                        size=len(member_rows),
                        dominant_flowers=dominant_flowers,
                        mean_profile=profile,
                    )
                )
                assignments.extend(
                    StatisticsClusterAssignmentRead(
                        session_id=row.session_id,
                        respondent_label=row.respondent_label,
                        cluster_id=cluster_id,
                        cluster_label=cluster_label,
                    )
                    for row in member_rows
                )

    cluster_payload = StatisticsClustersRead(
        insufficient_data=clusters_insufficient,
        message=cluster_message,
        respondents_count=respondents_count,
        cluster_count=len(clusters),
        silhouette_score=_round(silhouette_score),
        clusters=clusters,
        assignments=sorted(assignments, key=lambda item: (item.cluster_id, item.respondent_label)),
    )

    return StatisticsPayloadRead(
        overview=overview,
        reliability=reliability,
        factor_analysis=factor_analysis,
        clusters=cluster_payload,
    )


def collect_statistics_export_rows(
    db: Session,
    *,
    section: str,
) -> tuple[list[str], list[dict[str, Any]]]:
    payload = collect_statistics_payload(db)

    if section == "overview":
        fieldnames = [
            "scale_code",
            "scale_name",
            "short_code",
            "flower_code",
            "flower_title",
            "sample_mean_raw",
            "sample_standard_deviation_raw",
            "min_raw",
            "max_raw",
            "respondents_count",
        ]
        rows = [item.model_dump(mode="json") for item in payload.overview.scales]
        return fieldnames, rows

    if section == "reliability":
        scale_by_code = {item.scale_code: item for item in payload.reliability.scales}
        fieldnames = [
            "scale_code",
            "scale_name",
            "question_code",
            "question_order",
            "question_text",
            "cronbach_alpha",
            "interpretation",
            "respondents_count",
            "mean",
            "variance",
            "standard_deviation",
            "item_total_correlation",
            "alpha_if_deleted",
        ]
        rows = []
        for item in payload.reliability.items:
            scale = scale_by_code[item.scale_code]
            rows.append(
                {
                    "scale_code": item.scale_code,
                    "scale_name": item.scale_name,
                    "question_code": item.question_code,
                    "question_order": item.question_order,
                    "question_text": item.question_text,
                    "cronbach_alpha": scale.cronbach_alpha,
                    "interpretation": scale.interpretation,
                    "respondents_count": scale.respondents_count,
                    "mean": item.mean,
                    "variance": item.variance,
                    "standard_deviation": item.standard_deviation,
                    "item_total_correlation": item.item_total_correlation,
                    "alpha_if_deleted": item.alpha_if_deleted,
                }
            )
        return fieldnames, rows

    if section == "factor-analysis":
        component_columns = [component.component_key.lower() for component in payload.factor_analysis.components]
        fieldnames = [
            "scale_code",
            "scale_name",
            "short_code",
            "included_in_pca",
            "recommended_components",
            *[f"{column}_eigenvalue" for column in component_columns],
            *[f"{column}_explained_variance_ratio" for column in component_columns],
            *[f"{column}_loading" for column in component_columns[: (payload.factor_analysis.recommended_components or 0)]],
        ]
        rows: list[dict[str, Any]] = []
        for item in payload.factor_analysis.loadings:
            row: dict[str, Any] = {
                "scale_code": item.scale_code,
                "scale_name": item.scale_name,
                "short_code": item.short_code,
                "included_in_pca": item.scale_code in payload.factor_analysis.included_scale_codes,
                "recommended_components": payload.factor_analysis.recommended_components,
            }
            for component in payload.factor_analysis.components:
                key = component.component_key.lower()
                row[f"{key}_eigenvalue"] = component.eigenvalue
                row[f"{key}_explained_variance_ratio"] = component.explained_variance_ratio
            for index, value in enumerate(item.loadings, start=1):
                row[f"pc{index}_loading"] = value
            rows.append(row)
        return fieldnames, rows

    if section == "clusters":
        fieldnames = [
            "cluster_id",
            "cluster_label",
            "cluster_size",
            "silhouette_score",
            "dominant_flowers",
            "scale_code",
            "scale_name",
            "short_code",
            "mean_raw_score",
            "mean_external_z_score",
        ]
        rows = []
        for cluster in payload.clusters.clusters:
            for point in cluster.mean_profile:
                rows.append(
                    {
                        "cluster_id": cluster.cluster_id,
                        "cluster_label": cluster.label,
                        "cluster_size": cluster.size,
                        "silhouette_score": payload.clusters.silhouette_score,
                        "dominant_flowers": ", ".join(cluster.dominant_flowers),
                        "scale_code": point.scale_code,
                        "scale_name": point.scale_name,
                        "short_code": point.short_code,
                        "mean_raw_score": point.mean_raw_score,
                        "mean_external_z_score": point.mean_external_z_score,
                    }
                )
        return fieldnames, rows

    raise LookupError("Раздел статистики не найден")
