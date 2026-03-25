import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';
import { api } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');

  return {
    ...actual,
    api: {
      ...actual.api,
      getAnalyticsSummary: vi.fn(),
      getRespondentsRawMatrix: vi.fn(),
      getQuestionStats: vi.fn(),
      getRespondentRawScores: vi.fn(),
      getInternalConsistency: vi.fn(),
      getStatistics: vi.fn(),
      getDetailedAnalyticsExportUrl: vi.fn((format: 'csv' | 'json') => `/api/v1/admin/analytics/export/detailed?format=${format}`),
      getStatisticsExportUrl: vi.fn(
        (section: 'overview' | 'reliability' | 'factor-analysis' | 'clusters', format: 'csv' | 'json') =>
          `/api/v1/admin/analytics/statistics/export?section=${section}&format=${format}`,
      ),
    },
  };
});

const adminUser = {
  id: 'admin-1',
  username: 'chief',
  is_guest: false,
  role: 'admin',
  created_at: '2026-03-25T08:00:00Z',
};

const summaryPayload = {
  total_attempts: 2,
  completed_tests: 2,
  main_flower_distribution: [
    { flower_code: 'lily', flower_title: 'Лилия', flower_symbol: '⚪️', count: 1 },
    { flower_code: 'chrysanthemum', flower_title: 'Хризантема', flower_symbol: '✺', count: 1 },
  ],
  average_raw_scores: [
    { scale_code: 'hs', scale_title: 'Ипохондрия', short_code: 'HS', average_raw_score: 8.5 },
    { scale_code: 'd', scale_title: 'Депрессия', short_code: 'D', average_raw_score: 5.5 },
  ],
};

const matrixPayload = {
  scales: [
    { scale_code: 'hs', scale_name: 'Ипохондрия', short_code: 'HS', flower_code: 'lily' },
    { scale_code: 'd', scale_name: 'Депрессия', short_code: 'D', flower_code: 'chrysanthemum' },
  ],
  questions: [
    {
      question_id: 'q1',
      question_code: 'hs_01',
      question_order: 1,
      question_text: 'Вопрос 1',
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
    },
    {
      question_id: 'q2',
      question_code: 'hs_02',
      question_order: 2,
      question_text: 'Вопрос 2',
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
    },
    {
      question_id: 'q3',
      question_code: 'd_01',
      question_order: 3,
      question_text: 'Вопрос 3',
      scale_code: 'd',
      scale_name: 'Депрессия',
    },
  ],
  respondents: [
    {
      session_id: 'session-1',
      user_id: 'user-1',
      username: 'analyst-user',
      respondent_label: 'analyst-user',
      is_guest: false,
      submitted_at: '2026-03-25T08:30:00Z',
      duration_seconds: 132,
      main_flower_code: 'lily',
      main_flower_title: 'Лилия',
      raw_scores_by_scale: { hs: 12, d: 4 },
      z_scores_by_scale: { hs: 2.4, d: -0.3 },
      answers_by_question: { hs_01: 4, hs_02: 4, d_01: 1 },
    },
    {
      session_id: 'session-2',
      user_id: 'user-2',
      username: 'guest-abcd',
      respondent_label: 'Гость · guest-abcd',
      is_guest: true,
      submitted_at: '2026-03-25T09:15:00Z',
      duration_seconds: 175,
      main_flower_code: 'chrysanthemum',
      main_flower_title: 'Хризантема',
      raw_scores_by_scale: { hs: 3, d: 8 },
      z_scores_by_scale: { hs: -1.8, d: 1.6 },
      answers_by_question: { hs_01: 1, hs_02: 1, d_01: 4 },
    },
  ],
  question_stats: [],
};

const questionStatsPayload = {
  scale_code: null,
  respondents_count: 2,
  scales: matrixPayload.scales,
  questions: [
    {
      question_id: 'q1',
      question_code: 'hs_01',
      question_order: 1,
      question_text: 'Вопрос 1',
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
      mean_answer: 2.5,
      variance: 4.5,
      standard_deviation: 2.1213,
      count: 2,
      missing_count: 0,
      distribution: [
        { value: 0, count: 0 },
        { value: 1, count: 1 },
        { value: 2, count: 0 },
        { value: 3, count: 0 },
        { value: 4, count: 1 },
      ],
    },
    {
      question_id: 'q2',
      question_code: 'hs_02',
      question_order: 2,
      question_text: 'Вопрос 2',
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
      mean_answer: 2.5,
      variance: 4.5,
      standard_deviation: 2.1213,
      count: 2,
      missing_count: 0,
      distribution: [
        { value: 0, count: 0 },
        { value: 1, count: 1 },
        { value: 2, count: 0 },
        { value: 3, count: 0 },
        { value: 4, count: 1 },
      ],
    },
    {
      question_id: 'q3',
      question_code: 'd_01',
      question_order: 3,
      question_text: 'Вопрос 3',
      scale_code: 'd',
      scale_name: 'Депрессия',
      mean_answer: 2.5,
      variance: 4.5,
      standard_deviation: 2.1213,
      count: 2,
      missing_count: 0,
      distribution: [
        { value: 0, count: 0 },
        { value: 1, count: 1 },
        { value: 2, count: 0 },
        { value: 3, count: 0 },
        { value: 4, count: 1 },
      ],
    },
  ],
};

const internalConsistencyPayload = {
  scale_code: 'hs',
  scale_name: 'Ипохондрия',
  respondents_count: 2,
  questions_count: 2,
  cronbach_alpha: 0.91,
  insufficient_data: false,
  message: null,
  items: [
    {
      question_id: 'q1',
      question_code: 'hs_01',
      question_order: 1,
      question_text: 'Вопрос 1',
      mean: 2.5,
      variance: 4.5,
      standard_deviation: 2.1213,
      item_total_correlation: 0.88,
      alpha_if_deleted: 0.85,
    },
    {
      question_id: 'q2',
      question_code: 'hs_02',
      question_order: 2,
      question_text: 'Вопрос 2',
      mean: 2.5,
      variance: 4.5,
      standard_deviation: 2.1213,
      item_total_correlation: 0.86,
      alpha_if_deleted: 0.83,
    },
  ],
};

const respondentDetailPayload = {
  session_id: 'session-1',
  user_id: 'user-1',
  username: 'analyst-user',
  respondent_label: 'analyst-user',
  is_guest: false,
  submitted_at: '2026-03-25T08:30:00Z',
  duration_seconds: 132,
  mean: 4.2,
  standard_deviation: 1.8,
  main_flower: {
    scale_code: 'hs',
    flower_code: 'lily',
    flower_title: 'Лилия',
    flower_symbol: '⚪️',
    raw_score: 12,
    z_score: 2.4,
  },
  secondary_flower: {
    scale_code: 'd',
    flower_code: 'chrysanthemum',
    flower_title: 'Хризантема',
    flower_symbol: '✺',
    raw_score: 4,
    z_score: -0.3,
  },
  interpretation: {
    z_level_code: 'high',
    z_level_title: 'Высокая выраженность',
    profile_title: 'Личностный профиль',
    profile_summary: 'Краткая интерпретация профиля.',
    z_summary: 'Шкала выражена выше среднего уровня профиля.',
  },
  scales: [
    {
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
      flower_code: 'lily',
      flower_title: 'Лилия',
      flower_symbol: '⚪️',
      raw_score: 12,
      z_score: 2.4,
      rank: 1,
      questions: [
        {
          question_id: 'q1',
          question_code: 'hs_01',
          question_order: 1,
          question_text: 'Вопрос 1',
          scale_code: 'hs',
          scale_name: 'Ипохондрия',
          answer_value: 4,
          contribution_to_scale: 4,
        },
      ],
    },
    {
      scale_code: 'd',
      scale_name: 'Депрессия',
      flower_code: 'chrysanthemum',
      flower_title: 'Хризантема',
      flower_symbol: '✺',
      raw_score: 4,
      z_score: -0.3,
      rank: 2,
      questions: [
        {
          question_id: 'q3',
          question_code: 'd_01',
          question_order: 3,
          question_text: 'Вопрос 3',
          scale_code: 'd',
          scale_name: 'Депрессия',
          answer_value: 1,
          contribution_to_scale: 1,
        },
      ],
    },
  ],
};

const statisticsPayload = {
  overview: {
    insufficient_data: false,
    message: null,
    respondents_count: 6,
    scales: [
      {
        scale_code: 'hs',
        scale_name: 'Ипохондрия',
        short_code: 'Hs',
        flower_code: 'lily',
        flower_title: 'Лилия',
        flower_symbol: '⚪️',
        sample_mean_raw: 6.2,
        sample_standard_deviation_raw: 2.1,
        min_raw: 1,
        max_raw: 12,
        respondents_count: 6,
      },
      {
        scale_code: 'd',
        scale_name: 'Депрессия',
        short_code: 'D',
        flower_code: 'chrysanthemum',
        flower_title: 'Хризантема',
        flower_symbol: '✺',
        sample_mean_raw: 5.8,
        sample_standard_deviation_raw: 1.9,
        min_raw: 0,
        max_raw: 11,
        respondents_count: 6,
      },
    ],
    respondents: [
      {
        session_id: 'session-1',
        respondent_label: 'analyst-user',
        raw_scores_by_scale: { hs: 12, d: 4 },
        external_z_scores_by_scale: { hs: 1.4, d: -0.95 },
      },
      {
        session_id: 'session-2',
        respondent_label: 'Гость · guest-abcd',
        raw_scores_by_scale: { hs: 3, d: 8 },
        external_z_scores_by_scale: { hs: -1.52, d: 1.16 },
      },
    ],
  },
  reliability: {
    insufficient_data: false,
    message: null,
    scales: [
      {
        scale_code: 'hs',
        scale_name: 'Ипохондрия',
        short_code: 'Hs',
        flower_code: 'lily',
        flower_title: 'Лилия',
        flower_symbol: '⚪️',
        cronbach_alpha: 0.84,
        interpretation: 'Хорошо',
        questions_count: 3,
        respondents_count: 6,
      },
      {
        scale_code: 'd',
        scale_name: 'Депрессия',
        short_code: 'D',
        flower_code: 'chrysanthemum',
        flower_title: 'Хризантема',
        flower_symbol: '✺',
        cronbach_alpha: 0.76,
        interpretation: 'Приемлемо',
        questions_count: 3,
        respondents_count: 6,
      },
    ],
    items: [
      {
        scale_code: 'hs',
        scale_name: 'Ипохондрия',
        question_id: 'q1',
        question_code: 'hs_01',
        question_order: 1,
        question_text: 'Вопрос 1',
        mean: 2.5,
        variance: 1.2,
        standard_deviation: 1.0954,
        item_total_correlation: 0.62,
        alpha_if_deleted: 0.71,
      },
      {
        scale_code: 'd',
        scale_name: 'Депрессия',
        question_id: 'q2',
        question_code: 'd_01',
        question_order: 2,
        question_text: 'Вопрос 2',
        mean: 2.2,
        variance: 1.0,
        standard_deviation: 1,
        item_total_correlation: 0.54,
        alpha_if_deleted: 0.69,
      },
    ],
  },
  factor_analysis: {
    insufficient_data: false,
    message: null,
    respondents_count: 6,
    recommended_components: 2,
    included_scale_codes: ['hs', 'd'],
    excluded_scale_codes: [],
    components: [
      {
        component_key: 'PC1',
        component_index: 1,
        eigenvalue: 1.42,
        explained_variance_ratio: 0.71,
        cumulative_explained_variance_ratio: 0.71,
      },
      {
        component_key: 'PC2',
        component_index: 2,
        eigenvalue: 0.58,
        explained_variance_ratio: 0.29,
        cumulative_explained_variance_ratio: 1,
      },
    ],
    correlation_matrix: [
      {
        scale_code: 'hs',
        scale_name: 'Ипохондрия',
        values: [
          { scale_code: 'hs', scale_name: 'Ипохондрия', value: 1 },
          { scale_code: 'd', scale_name: 'Депрессия', value: -0.44 },
        ],
      },
      {
        scale_code: 'd',
        scale_name: 'Депрессия',
        values: [
          { scale_code: 'hs', scale_name: 'Ипохондрия', value: -0.44 },
          { scale_code: 'd', scale_name: 'Депрессия', value: 1 },
        ],
      },
    ],
    loadings: [
      { scale_code: 'hs', scale_name: 'Ипохондрия', short_code: 'Hs', loadings: [0.82, 0.17] },
      { scale_code: 'd', scale_name: 'Депрессия', short_code: 'D', loadings: [-0.82, 0.17] },
    ],
  },
  clusters: {
    insufficient_data: false,
    message: null,
    respondents_count: 6,
    cluster_count: 2,
    silhouette_score: 0.47,
    clusters: [
      {
        cluster_id: 'cluster_1',
        label: 'Кластер 1',
        size: 3,
        dominant_flowers: ['Лилия', 'Гербера', 'Тюльпан'],
        mean_profile: [
          {
            scale_code: 'hs',
            scale_name: 'Ипохондрия',
            short_code: 'Hs',
            mean_raw_score: 10,
            mean_external_z_score: 1.1,
          },
          {
            scale_code: 'd',
            scale_name: 'Депрессия',
            short_code: 'D',
            mean_raw_score: 3,
            mean_external_z_score: -0.8,
          },
        ],
      },
      {
        cluster_id: 'cluster_2',
        label: 'Кластер 2',
        size: 3,
        dominant_flowers: ['Хризантема', 'Подсолнух', 'Ирис'],
        mean_profile: [
          {
            scale_code: 'hs',
            scale_name: 'Ипохондрия',
            short_code: 'Hs',
            mean_raw_score: 2,
            mean_external_z_score: -1.1,
          },
          {
            scale_code: 'd',
            scale_name: 'Депрессия',
            short_code: 'D',
            mean_raw_score: 9,
            mean_external_z_score: 0.8,
          },
        ],
      },
    ],
    assignments: [
      {
        session_id: 'session-1',
        respondent_label: 'analyst-user',
        cluster_id: 'cluster_1',
        cluster_label: 'Кластер 1',
      },
      {
        session_id: 'session-2',
        respondent_label: 'Гость · guest-abcd',
        cluster_id: 'cluster_2',
        cluster_label: 'Кластер 2',
      },
    ],
  },
};

function renderDashboard() {
  vi.mocked(api.getAnalyticsSummary).mockResolvedValue(summaryPayload);
  vi.mocked(api.getRespondentsRawMatrix).mockResolvedValue(matrixPayload);
  vi.mocked(api.getQuestionStats).mockResolvedValue(questionStatsPayload);
  vi.mocked(api.getInternalConsistency).mockResolvedValue(internalConsistencyPayload);
  vi.mocked(api.getRespondentRawScores).mockResolvedValue(respondentDetailPayload);
  vi.mocked(api.getStatistics).mockResolvedValue(statisticsPayload);

  return render(
    <MemoryRouter>
      <AdminAnalyticsDashboard user={adminUser} />
    </MemoryRouter>,
  );
}

describe('AdminAnalyticsDashboard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview charts and summary metrics', async () => {
    const { container } = renderDashboard();

    expect(await screen.findByText('Распределение главных цветков')).toBeInTheDocument();
    expect(screen.getByText('Распределение стандартизированных значений (Z-оценок)')).toBeInTheDocument();
    expect(screen.getByText('Сравнение распределений по шкалам')).toBeInTheDocument();
    expect(screen.getByText(/Гистограмма показывает, как распределяются сырые баллы/)).toBeInTheDocument();
    expect(screen.getByText('Испытуемых в сводке')).toBeInTheDocument();
    expect(screen.getAllByText('1 испытуемый')).toHaveLength(2);
    await waitFor(() => {
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
  });

  it('falls back to respondent matrix when summary distribution is empty', async () => {
    vi.mocked(api.getAnalyticsSummary).mockResolvedValue({
      ...summaryPayload,
      main_flower_distribution: [],
    });

    render(
      <MemoryRouter>
        <AdminAnalyticsDashboard user={adminUser} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Распределение главных цветков')).toBeInTheDocument();
    expect(screen.getByText('Испытуемых в сводке')).toBeInTheDocument();
    expect(screen.getAllByText('1 испытуемый')).toHaveLength(2);
  });

  it('opens detailed respondent view and renders raw and z charts', async () => {
    const { container } = renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Испытуемые' }));
    fireEvent.click(await screen.findAllByRole('button', { name: 'Подробнее' }).then((buttons) => buttons[0]));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Сырые баллы по шкалам')).toBeInTheDocument();
    expect(within(dialog).getByText('Z-оценки по шкалам')).toBeInTheDocument();
    expect(within(dialog).getByText('Профиль по шкалам и рангам')).toBeInTheDocument();
    expect(within(dialog).getByText('Вторичный цветок')).toBeInTheDocument();
    expect(within(dialog).getByText('Интерпретация')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelectorAll('.modal-card svg').length).toBeGreaterThan(0);
    });
  });

  it('closes respondent modal by the dismiss button', async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Испытуемые' }));
    fireEvent.click(await screen.findAllByRole('button', { name: 'Подробнее' }).then((buttons) => buttons[0]));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes respondent modal by Escape', async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Испытуемые' }));
    fireEvent.click(await screen.findAllByRole('button', { name: 'Подробнее' }).then((buttons) => buttons[0]));

    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders item-level tables and question charts', async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Вопросы' }));

    expect(await screen.findByText('Тепловая карта ответов по вопросам')).toBeInTheDocument();
    expect(screen.getByText('Средний балл по каждому вопросу')).toBeInTheDocument();
    expect(screen.getByText('Распределение ответов по вопросу')).toBeInTheDocument();
    expect(screen.getByText('Сводная таблица по вопросам')).toBeInTheDocument();
    expect(screen.getAllByText('Вопрос 1').length).toBeGreaterThan(0);
  });

  it('loads the psychometrics tab with normalization, reliability, factor and cluster sections', async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Психометрика' }));

    expect(await screen.findByText('Внешнее нормирование по выборке')).toBeInTheDocument();
    expect(screen.getByText('Альфа Кронбаха и вклад вопросов')).toBeInTheDocument();
    expect(screen.getByText('PCA, корреляции и scree plot')).toBeInTheDocument();
    expect(screen.getByText('Кластеризация профилей по шкалам')).toBeInTheDocument();
    expect(screen.getByText(/Внешнее нормирование сравнивает/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CSV' })).toHaveAttribute(
      'href',
      '/api/v1/admin/analytics/statistics/export?section=overview&format=csv',
    );
    expect(api.getStatistics).toHaveBeenCalledTimes(1);
  });
});
