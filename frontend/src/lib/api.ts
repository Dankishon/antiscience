export interface User {
  id: string;
  username: string;
  is_guest: boolean;
  role: string;
  created_at: string;
}

export interface SurveyQuestion {
  code: string;
  number: number;
  prompt: string;
  scale_code: string;
  flower_code: string;
  flower_title: string;
  flower_symbol: string | null;
  min_value: number;
  max_value: number;
}

export interface ActiveSurvey {
  code: string;
  version: number;
  title: string;
  description: string;
  instruction: string;
  algorithm_version: string;
  question_count: number;
  likert_scale: Array<{
    value: number;
    label: string;
  }>;
  questions: SurveyQuestion[];
}

export interface ResponseSession {
  id: string;
  survey_code: string;
  survey_version: number;
  status: string;
  answered_count: number;
  total_questions: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface ResultPayload {
  response_session_id: string;
  survey_code: string;
  survey_version: number;
  algorithm_version: string;
  mean: number;
  standard_deviation: number;
  main_flower: {
    scale_code: string;
    flower_code: string;
    flower_title: string;
    flower_symbol: string | null;
    raw_score: number;
    z_score: number;
  };
  tie_break: {
    applied: boolean;
    strategy: string;
    candidate_flower_codes: string[];
  };
  scale_scores: Array<{
    scale_code: string;
    flower_code: string;
    flower_title: string;
    flower_symbol: string | null;
    raw_score: number;
    z_score: number;
    rank: number;
    z_level_code: string | null;
    z_level_title: string | null;
  }>;
  interpretation: {
    z_level_code: string | null;
    z_level_title: string | null;
    profile_title: string | null;
    profile_summary: string | null;
    profile_source_header: string | null;
    z_summary: string | null;
    traits: Array<{
      code: string;
      label: string;
      description: string;
      polarity: string;
      sortOrder: number;
    }>;
  };
  submitted_at: string | null;
}

export interface MyResultSummary {
  id: string;
  response_session_id: string;
  is_guest_session: boolean;
  main_flower: ResultPayload['main_flower'];
  mean: number;
  standard_deviation: number;
  tie_break_strategy: string;
  submitted_at: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  total_attempts: number;
  completed_tests: number;
  main_flower_distribution: Array<{
    flower_code: string;
    flower_title: string;
    flower_symbol: string | null;
    count: number;
  }>;
  average_raw_scores: Array<{
    scale_code: string;
    scale_title: string;
    short_code: string;
    average_raw_score: number;
  }>;
}

export interface AdminScaleMeta {
  scale_code: string;
  scale_name: string;
  short_code: string;
  flower_code: string;
}

export interface AdminQuestionMeta {
  question_id: string;
  question_code: string;
  question_order: number;
  question_text: string;
  scale_code: string;
  scale_name: string;
}

export interface AdminQuestionStat extends AdminQuestionMeta {
  mean_answer: number;
  variance: number;
  standard_deviation: number;
  count: number;
  missing_count: number;
  distribution: AdminDistributionBucket[];
}

export interface AdminDistributionBucket {
  value: number;
  count: number;
}

export interface AdminQuestionStatsPayload {
  scale_code: string | null;
  respondents_count: number;
  scales: AdminScaleMeta[];
  questions: AdminQuestionStat[];
}

export interface AdminRespondentMatrixRow {
  session_id: string;
  user_id: string;
  username: string;
  respondent_label: string;
  is_guest: boolean;
  submitted_at: string | null;
  duration_seconds: number | null;
  main_flower_code: string | null;
  main_flower_title: string | null;
  raw_scores_by_scale: Record<string, number>;
  z_scores_by_scale: Record<string, number>;
  answers_by_question: Record<string, number | null>;
}

export interface AdminRespondentRawMatrix {
  scales: AdminScaleMeta[];
  questions: AdminQuestionMeta[];
  respondents: AdminRespondentMatrixRow[];
  question_stats: AdminQuestionStat[];
}

export interface AdminRespondentQuestion {
  question_id: string;
  question_code: string;
  question_order: number;
  question_text: string;
  scale_code: string;
  scale_name: string;
  answer_value: number | null;
  contribution_to_scale: number | null;
}

export interface AdminRespondentScale {
  scale_code: string;
  scale_name: string;
  flower_code: string;
  flower_title: string;
  flower_symbol: string | null;
  raw_score: number;
  z_score: number;
  rank: number;
  questions: AdminRespondentQuestion[];
}

export interface AdminRespondentRawScores {
  session_id: string;
  user_id: string;
  username: string;
  respondent_label: string;
  is_guest: boolean;
  submitted_at: string | null;
  duration_seconds: number | null;
  mean: number | null;
  standard_deviation: number | null;
  main_flower: {
    scale_code: string;
    flower_code: string;
    flower_title: string;
    flower_symbol: string | null;
    raw_score: number;
    z_score: number;
  } | null;
  secondary_flower: {
    scale_code: string;
    flower_code: string;
    flower_title: string;
    flower_symbol: string | null;
    raw_score: number;
    z_score: number;
  } | null;
  interpretation: {
    z_level_code: string | null;
    z_level_title: string | null;
    profile_title: string | null;
    profile_summary: string | null;
    z_summary: string | null;
  } | null;
  scales: AdminRespondentScale[];
}

export interface InternalConsistencyItem {
  question_id: string;
  question_code: string;
  question_order: number;
  question_text: string;
  mean: number;
  variance: number;
  standard_deviation: number;
  item_total_correlation: number | null;
  alpha_if_deleted: number | null;
}

export interface InternalConsistencyPayload {
  scale_code: string;
  scale_name: string;
  respondents_count: number;
  questions_count: number;
  cronbach_alpha: number | null;
  insufficient_data: boolean;
  message: string | null;
  items: InternalConsistencyItem[];
}

export interface StatisticsScaleSummary {
  scale_code: string;
  scale_name: string;
  short_code: string;
  flower_code: string;
  flower_title: string;
  flower_symbol: string | null;
  sample_mean_raw: number;
  sample_standard_deviation_raw: number;
  min_raw: number;
  max_raw: number;
  respondents_count: number;
}

export interface StatisticsRespondentProfile {
  session_id: string;
  respondent_label: string;
  raw_scores_by_scale: Record<string, number>;
  external_z_scores_by_scale: Record<string, number>;
}

export interface StatisticsOverview {
  insufficient_data: boolean;
  message: string | null;
  respondents_count: number;
  scales: StatisticsScaleSummary[];
  respondents: StatisticsRespondentProfile[];
}

export interface StatisticsReliabilityScale {
  scale_code: string;
  scale_name: string;
  short_code: string;
  flower_code: string;
  flower_title: string;
  flower_symbol: string | null;
  cronbach_alpha: number | null;
  interpretation: string;
  questions_count: number;
  respondents_count: number;
}

export interface StatisticsReliabilityItem {
  scale_code: string;
  scale_name: string;
  question_id: string;
  question_code: string;
  question_order: number;
  question_text: string;
  mean: number;
  variance: number;
  standard_deviation: number;
  item_total_correlation: number | null;
  alpha_if_deleted: number | null;
}

export interface StatisticsReliability {
  insufficient_data: boolean;
  message: string | null;
  scales: StatisticsReliabilityScale[];
  items: StatisticsReliabilityItem[];
}

export interface StatisticsCorrelationValue {
  scale_code: string;
  scale_name: string;
  value: number;
}

export interface StatisticsCorrelationRow {
  scale_code: string;
  scale_name: string;
  values: StatisticsCorrelationValue[];
}

export interface StatisticsPcaComponent {
  component_key: string;
  component_index: number;
  eigenvalue: number;
  explained_variance_ratio: number;
  cumulative_explained_variance_ratio: number;
}

export interface StatisticsFactorLoading {
  scale_code: string;
  scale_name: string;
  short_code: string;
  loadings: Array<number | null>;
}

export interface StatisticsFactorAnalysis {
  insufficient_data: boolean;
  message: string | null;
  respondents_count: number;
  recommended_components: number | null;
  included_scale_codes: string[];
  excluded_scale_codes: string[];
  components: StatisticsPcaComponent[];
  correlation_matrix: StatisticsCorrelationRow[];
  loadings: StatisticsFactorLoading[];
}

export interface StatisticsClusterProfilePoint {
  scale_code: string;
  scale_name: string;
  short_code: string;
  mean_raw_score: number;
  mean_external_z_score: number;
}

export interface StatisticsCluster {
  cluster_id: string;
  label: string;
  size: number;
  dominant_flowers: string[];
  mean_profile: StatisticsClusterProfilePoint[];
}

export interface StatisticsClusterAssignment {
  session_id: string;
  respondent_label: string;
  cluster_id: string;
  cluster_label: string;
}

export interface StatisticsClusters {
  insufficient_data: boolean;
  message: string | null;
  respondents_count: number;
  cluster_count: number;
  silhouette_score: number | null;
  clusters: StatisticsCluster[];
  assignments: StatisticsClusterAssignment[];
}

export interface StatisticsPayload {
  overview: StatisticsOverview;
  reliability: StatisticsReliability;
  factor_analysis: StatisticsFactorAnalysis;
  clusters: StatisticsClusters;
}

type AuthResponse = {
  user: User;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ detail: 'Не удалось выполнить запрос' }))) as { detail?: string };
    throw new Error(payload.detail ?? 'Не удалось выполнить запрос');
  }

  return (await response.json()) as T;
}

export const api = {
  getCurrentUser: () => request<AuthResponse>('/api/v1/auth/me'),
  register: (payload: { username: string; password: string }) =>
    request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { username: string; password: string }) =>
    request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  guestLogin: () =>
    request<AuthResponse>('/api/v1/auth/guest', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  logout: () =>
    request<{ ok: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getActiveSurvey: () => request<ActiveSurvey>('/api/v1/survey/active'),
  createResponse: () =>
    request<ResponseSession>('/api/v1/responses', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  saveAnswer: (sessionId: string, answer: { question_code: string; value: number }) =>
    request<ResponseSession>(`/api/v1/responses/${sessionId}/answers`, {
      method: 'PUT',
      body: JSON.stringify({ answers: [answer] }),
    }),
  submitResponse: (sessionId: string) =>
    request<ResultPayload>(`/api/v1/responses/${sessionId}/submit`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getResult: (sessionId: string) => request<ResultPayload>(`/api/v1/responses/${sessionId}/result`),
  getMyResults: () => request<MyResultSummary[]>('/api/v1/me/results'),
  deleteMyResult: (resultId: string) =>
    request<{ ok: boolean }>(`/api/v1/me/results/${resultId}`, {
      method: 'DELETE',
    }),
  getAnalyticsSummary: () => request<AnalyticsSummary>('/api/v1/admin/analytics/summary'),
  getRespondentsRawMatrix: (scaleCode?: string) =>
    request<AdminRespondentRawMatrix>(
      scaleCode
        ? `/api/v1/admin/analytics/respondents/raw-matrix?scale_code=${encodeURIComponent(scaleCode)}`
        : '/api/v1/admin/analytics/respondents/raw-matrix',
    ),
  getQuestionStats: (scaleCode?: string) =>
    request<AdminQuestionStatsPayload>(
      scaleCode
        ? `/api/v1/admin/analytics/question-stats?scale_code=${encodeURIComponent(scaleCode)}`
        : '/api/v1/admin/analytics/question-stats',
    ),
  getRespondentRawScores: (sessionId: string) =>
    request<AdminRespondentRawScores>(`/api/v1/admin/analytics/respondents/${sessionId}/raw-scores`),
  getInternalConsistency: (scaleCode: string) =>
    request<InternalConsistencyPayload>(
      `/api/v1/admin/analytics/internal-consistency?scale_code=${encodeURIComponent(scaleCode)}`,
    ),
  getStatistics: () => request<StatisticsPayload>('/api/v1/admin/analytics/statistics'),
  getDetailedAnalyticsExportUrl: (format: 'csv' | 'json') =>
    `/api/v1/admin/analytics/export/detailed?format=${format}`,
  getStatisticsExportUrl: (
    section: 'overview' | 'reliability' | 'factor-analysis' | 'clusters',
    format: 'csv' | 'json',
  ) =>
    `/api/v1/admin/analytics/statistics/export?section=${encodeURIComponent(section)}&format=${format}`,
};
