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
      getDetailedAnalyticsExportUrl: vi.fn((format: 'csv' | 'json') => `/api/v1/admin/analytics/export/detailed?format=${format}`),
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
    { flower_code: 'lily', flower_title: 'Лилия', flower_symbol: '⚪️', count: 2 },
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

function renderDashboard() {
  vi.mocked(api.getAnalyticsSummary).mockResolvedValue(summaryPayload);
  vi.mocked(api.getRespondentsRawMatrix).mockResolvedValue(matrixPayload);
  vi.mocked(api.getQuestionStats).mockResolvedValue(questionStatsPayload);
  vi.mocked(api.getInternalConsistency).mockResolvedValue(internalConsistencyPayload);
  vi.mocked(api.getRespondentRawScores).mockResolvedValue(respondentDetailPayload);

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
    await waitFor(() => {
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
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
});
