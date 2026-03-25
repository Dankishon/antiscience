import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { api } from './lib/api';

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual<typeof import('./lib/api')>('./lib/api');

  return {
    ...actual,
    api: {
      ...actual.api,
      getCurrentUser: vi.fn(),
      register: vi.fn(),
      login: vi.fn(),
      guestLogin: vi.fn(),
      logout: vi.fn(),
      getActiveSurvey: vi.fn(),
      createResponse: vi.fn(),
      saveAnswer: vi.fn(),
      submitResponse: vi.fn(),
      getResult: vi.fn(),
      getMyResults: vi.fn(),
      deleteMyResult: vi.fn(),
      getAnalyticsSummary: vi.fn(),
      getRespondentsRawMatrix: vi.fn(),
      getQuestionStats: vi.fn(),
      getRespondentRawScores: vi.fn(),
      getInternalConsistency: vi.fn(),
      getStatistics: vi.fn(),
      getDetailedAnalyticsExportUrl: vi.fn(),
      getStatisticsExportUrl: vi.fn(),
    },
  };
});

const currentUser = {
  id: 'user-1',
  username: 'danler',
  is_guest: false,
  role: 'user',
  created_at: '2026-03-25T09:00:00Z',
};

const activeSurvey = {
  code: 'flower-soul-profile',
  version: 1,
  title: 'Цветочный профиль души',
  description: 'Описание',
  instruction: 'Инструкция',
  algorithm_version: 'v1',
  question_count: 2,
  likert_scale: [
    { value: 0, label: 'совершенно не согласен' },
    { value: 1, label: 'скорее не согласен' },
    { value: 2, label: 'нейтрально / не могу сказать' },
    { value: 3, label: 'скорее согласен' },
    { value: 4, label: 'полностью согласен' },
  ],
  questions: [
    {
      code: 'hs_01',
      number: 1,
      prompt: 'Первый вопрос',
      scale_code: 'hs',
      flower_code: 'lily',
      flower_title: 'Лилия',
      flower_symbol: '⚜️',
      min_value: 0,
      max_value: 4,
    },
    {
      code: 'hs_02',
      number: 2,
      prompt: 'Второй вопрос',
      scale_code: 'hs',
      flower_code: 'lily',
      flower_title: 'Лилия',
      flower_symbol: '⚜️',
      min_value: 0,
      max_value: 4,
    },
  ],
};

const responseSession = {
  id: 'session-1',
  survey_code: 'flower-soul-profile',
  survey_version: 1,
  status: 'in_progress',
  answered_count: 0,
  total_questions: 2,
  created_at: '2026-03-25T09:00:00Z',
  updated_at: '2026-03-25T09:00:00Z',
  submitted_at: null,
};

function renderQuestionnaireRoute() {
  return render(
    <MemoryRouter initialEntries={['/questionnaire']}>
      <App />
    </MemoryRouter>,
  );
}

describe('Questionnaire route', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders questionnaire successfully with survey data and session', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({ user: currentUser });
    vi.mocked(api.getActiveSurvey).mockResolvedValue(activeSurvey);
    vi.mocked(api.createResponse).mockResolvedValue(responseSession);

    renderQuestionnaireRoute();

    expect(await screen.findByText('Первый вопрос')).toBeInTheDocument();
    expect(screen.getByText('Структура опроса')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Следующий вопрос' })).toBeInTheDocument();
  });

  it('restores a malformed draft safely instead of crashing the page', async () => {
    window.localStorage.setItem(
      'flower-profile-questionnaire-draft:user-1',
      JSON.stringify({
        surveyCode: 'flower-soul-profile',
        surveyVersion: 1,
        responseSession,
        answers: {},
        currentIndex: -1,
        updatedAt: '2026-03-25T09:01:00Z',
      }),
    );

    vi.mocked(api.getCurrentUser).mockResolvedValue({ user: currentUser });
    vi.mocked(api.getActiveSurvey).mockResolvedValue(activeSurvey);
    vi.mocked(api.createResponse).mockResolvedValue(responseSession);

    renderQuestionnaireRoute();

    expect(await screen.findByText('Первый вопрос')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.createResponse).toHaveBeenCalledTimes(1);
    });
  });

  it('shows a safe fallback when survey payload has no questions', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({ user: currentUser });
    vi.mocked(api.getActiveSurvey).mockResolvedValue({
      ...activeSurvey,
      question_count: 0,
      questions: [],
    });

    renderQuestionnaireRoute();

    expect(await screen.findByText('Сейчас опрос недоступен')).toBeInTheDocument();
    expect(screen.getByText(/не удалось загрузить вопросы или шкалу ответов/i)).toBeInTheDocument();
  });

  it('shows an error state when survey request fails instead of white screen', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({ user: currentUser });
    vi.mocked(api.getActiveSurvey).mockRejectedValue(new Error('Сервис временно недоступен'));

    renderQuestionnaireRoute();

    expect(await screen.findByText('Сейчас опрос недоступен')).toBeInTheDocument();
    expect(screen.getByText('Сервис временно недоступен')).toBeInTheDocument();
  });
});
