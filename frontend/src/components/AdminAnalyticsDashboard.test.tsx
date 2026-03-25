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
      question_code: 'hs_03',
      question_order: 3,
      question_text: 'Вопрос 3',
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
    },
    {
      question_id: 'q4',
      question_code: 'd_01',
      question_order: 4,
      question_text: 'Вопрос 4',
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
      raw_scores_by_scale: { hs: 12, d: 4 },
      answers_by_question: { hs_01: 4, hs_02: 4, hs_03: 4, d_01: 1 },
    },
    {
      session_id: 'session-2',
      user_id: 'user-2',
      username: 'guest-abcd',
      respondent_label: 'Гость · guest-abcd',
      is_guest: true,
      submitted_at: '2026-03-25T09:15:00Z',
      raw_scores_by_scale: { hs: 3, d: 8 },
      answers_by_question: { hs_01: 1, hs_02: 1, hs_03: 1, d_01: 4 },
    },
  ],
  question_stats: [
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
    },
    {
      question_id: 'q3',
      question_code: 'hs_03',
      question_order: 3,
      question_text: 'Вопрос 3',
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
      mean_answer: 2.5,
      variance: 4.5,
      standard_deviation: 2.1213,
      count: 2,
    },
    {
      question_id: 'q4',
      question_code: 'd_01',
      question_order: 4,
      question_text: 'Вопрос 4',
      scale_code: 'd',
      scale_name: 'Депрессия',
      mean_answer: 2.5,
      variance: 4.5,
      standard_deviation: 2.1213,
      count: 2,
    },
  ],
};

const internalConsistencyPayload = {
  scale_code: 'hs',
  scale_name: 'Ипохондрия',
  respondents_count: 2,
  questions_count: 3,
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
      item_total_correlation: 0.86,
      alpha_if_deleted: 0.83,
    },
    {
      question_id: 'q3',
      question_code: 'hs_03',
      question_order: 3,
      question_text: 'Вопрос 3',
      mean: 2.5,
      variance: 4.5,
      item_total_correlation: 0.9,
      alpha_if_deleted: 0.82,
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
  scales: [
    {
      scale_code: 'hs',
      scale_name: 'Ипохондрия',
      raw_score: 12,
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
      raw_score: 4,
      questions: [
        {
          question_id: 'q4',
          question_code: 'd_01',
          question_order: 4,
          question_text: 'Вопрос 4',
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

  it('renders the respondent table from raw matrix data', async () => {
    renderDashboard();

    expect(await screen.findByText('Список всех прохождений')).toBeInTheDocument();
    expect(screen.getAllByText('analyst-user').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Гость · guest-abcd').length).toBeGreaterThan(0);
    expect(screen.getByText('Ипохондрия · 12')).toBeInTheDocument();
  });

  it('opens detailed respondent view and renders raw scores table', async () => {
    renderDashboard();

    fireEvent.click(await screen.findAllByRole('button', { name: 'Подробнее' }).then((buttons) => buttons[0]));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Шкалы и итоговые raw score')).toBeInTheDocument();
    expect(screen.getByText('Вклад каждого вопроса в raw score')).toBeInTheDocument();
    expect(screen.getAllByText('Ипохондрия').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  it('renders scale bar chart inside respondent detail modal', async () => {
    const { container } = renderDashboard();

    fireEvent.click(await screen.findAllByRole('button', { name: 'Подробнее' }).then((buttons) => buttons[0]));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Сырые баллы по шкалам')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelectorAll('.modal-card .bar-fill').length).toBeGreaterThan(0);
    });
  });
});
