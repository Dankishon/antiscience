import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminRespondentModal } from './AdminRespondentModal';

const detail = {
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
    flower_code: 'rose',
    flower_title: 'Роза',
    flower_symbol: '✿',
    raw_score: 9,
    z_score: 1.1,
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
  ],
};

describe('AdminRespondentModal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders respondent detail content', () => {
    render(
      <AdminRespondentModal
        detail={detail}
        error={null}
        formatDate={() => '25 марта 2026 г. в 11:32'}
        loading={false}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'analyst-user' })).toBeInTheDocument();
    expect(screen.getByText('Вторичный цветок')).toBeInTheDocument();
    expect(screen.getByText('Краткая интерпретация профиля.')).toBeInTheDocument();
    expect(screen.getByText('Вклад каждого вопроса в шкалу')).toBeInTheDocument();
  });

  it('closes by dismiss button, backdrop and Escape', () => {
    const onClose = vi.fn();
    const { container } = render(
      <AdminRespondentModal
        detail={detail}
        error={null}
        formatDate={() => '25 марта 2026 г. в 11:32'}
        loading={false}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByLabelText('Закрыть окно'));
    fireEvent.click(container.querySelector('.modal-backdrop') as HTMLDivElement);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
