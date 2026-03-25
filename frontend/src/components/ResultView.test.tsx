import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ResultView } from './ResultView';

const resultPayload = {
  response_session_id: 'session-1',
  survey_code: 'flower-soul-profile',
  survey_version: 1,
  algorithm_version: '1.0.0',
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
  tie_break: {
    applied: true,
    strategy: 'random_among_top',
    candidate_flower_codes: ['lily', 'chrysanthemum'],
  },
  scale_scores: [
    {
      scale_code: 'hs',
      flower_code: 'lily',
      flower_title: 'Лилия',
      flower_symbol: '⚪️',
      raw_score: 12,
      z_score: 2.4,
      rank: 1,
      z_level_code: null,
      z_level_title: null,
    },
    {
      scale_code: 'd',
      flower_code: 'chrysanthemum',
      flower_title: 'Хризантема',
      flower_symbol: '✺',
      raw_score: 11,
      z_score: 2.1,
      rank: 2,
      z_level_code: null,
      z_level_title: null,
    },
    {
      scale_code: 'hy',
      flower_code: 'rose',
      flower_title: 'Роза',
      flower_symbol: '✿',
      raw_score: 9,
      z_score: 1.1,
      rank: 3,
      z_level_code: null,
      z_level_title: null,
    },
  ],
  interpretation: {
    z_level_code: null,
    z_level_title: null,
    profile_title: 'Личностный профиль',
    profile_summary: 'Спокойствие; выразительность, внимательность',
    profile_source_header: null,
    z_summary: 'Высокая выраженность по нескольким цветкам.',
    traits: [],
  },
  submitted_at: '2026-03-25T08:30:00Z',
};

describe('ResultView', () => {
  it('renders profile charts and top flowers block', async () => {
    const { container } = render(
      <MemoryRouter>
        <ResultView result={resultPayload} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Профиль вашей души')).toBeInTheDocument();
    expect(screen.getByText('Выраженность всех цветков')).toBeInTheDocument();
    expect(screen.getByText('Наиболее выраженные цветки')).toBeInTheDocument();
    expect(
      screen.getByText('Этот график показывает сырую выраженность каждого цветка по результатам теста.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('У вас ярко выражены несколько цветков души. Наш алгоритм выбрал для вас главный с учетом ваших Z-оценок'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
  });
});
