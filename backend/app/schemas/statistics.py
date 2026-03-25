from __future__ import annotations

from pydantic import BaseModel


class StatisticsScaleSummaryRead(BaseModel):
    scale_code: str
    scale_name: str
    short_code: str
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    sample_mean_raw: float
    sample_standard_deviation_raw: float
    min_raw: float
    max_raw: float
    respondents_count: int


class StatisticsRespondentProfileRead(BaseModel):
    session_id: str
    respondent_label: str
    raw_scores_by_scale: dict[str, int]
    external_z_scores_by_scale: dict[str, float]


class StatisticsOverviewRead(BaseModel):
    insufficient_data: bool
    message: str | None
    respondents_count: int
    scales: list[StatisticsScaleSummaryRead]
    respondents: list[StatisticsRespondentProfileRead]


class StatisticsReliabilityScaleRead(BaseModel):
    scale_code: str
    scale_name: str
    short_code: str
    flower_code: str
    flower_title: str
    flower_symbol: str | None
    cronbach_alpha: float | None
    interpretation: str
    questions_count: int
    respondents_count: int


class StatisticsReliabilityItemRead(BaseModel):
    scale_code: str
    scale_name: str
    question_id: str
    question_code: str
    question_order: int
    question_text: str
    mean: float
    variance: float
    standard_deviation: float
    item_total_correlation: float | None
    alpha_if_deleted: float | None


class StatisticsReliabilityRead(BaseModel):
    insufficient_data: bool
    message: str | None
    scales: list[StatisticsReliabilityScaleRead]
    items: list[StatisticsReliabilityItemRead]


class StatisticsCorrelationValueRead(BaseModel):
    scale_code: str
    scale_name: str
    value: float


class StatisticsCorrelationRowRead(BaseModel):
    scale_code: str
    scale_name: str
    values: list[StatisticsCorrelationValueRead]


class StatisticsPcaComponentRead(BaseModel):
    component_key: str
    component_index: int
    eigenvalue: float
    explained_variance_ratio: float
    cumulative_explained_variance_ratio: float


class StatisticsFactorLoadingRead(BaseModel):
    scale_code: str
    scale_name: str
    short_code: str
    loadings: list[float | None]


class StatisticsFactorAnalysisRead(BaseModel):
    insufficient_data: bool
    message: str | None
    respondents_count: int
    recommended_components: int | None
    included_scale_codes: list[str]
    excluded_scale_codes: list[str]
    components: list[StatisticsPcaComponentRead]
    correlation_matrix: list[StatisticsCorrelationRowRead]
    loadings: list[StatisticsFactorLoadingRead]


class StatisticsClusterProfilePointRead(BaseModel):
    scale_code: str
    scale_name: str
    short_code: str
    mean_raw_score: float
    mean_external_z_score: float


class StatisticsClusterRead(BaseModel):
    cluster_id: str
    label: str
    size: int
    dominant_flowers: list[str]
    mean_profile: list[StatisticsClusterProfilePointRead]


class StatisticsClusterAssignmentRead(BaseModel):
    session_id: str
    respondent_label: str
    cluster_id: str
    cluster_label: str


class StatisticsClustersRead(BaseModel):
    insufficient_data: bool
    message: str | None
    respondents_count: int
    cluster_count: int
    silhouette_score: float | None
    clusters: list[StatisticsClusterRead]
    assignments: list[StatisticsClusterAssignmentRead]


class StatisticsPayloadRead(BaseModel):
    overview: StatisticsOverviewRead
    reliability: StatisticsReliabilityRead
    factor_analysis: StatisticsFactorAnalysisRead
    clusters: StatisticsClustersRead
