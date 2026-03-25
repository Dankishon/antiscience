import { describe, expect, it } from 'vitest';
import { buildScaleHistogram, buildZScoreHistogram } from './adminAnalytics';

const respondents = [
  {
    session_id: 's1',
    user_id: 'u1',
    username: 'one',
    respondent_label: 'one',
    is_guest: false,
    submitted_at: null,
    duration_seconds: 120,
    main_flower_code: 'lily',
    main_flower_title: 'Лилия',
    raw_scores_by_scale: { hs: 3 },
    z_scores_by_scale: { hs: -0.6 },
    answers_by_question: {},
  },
  {
    session_id: 's2',
    user_id: 'u2',
    username: 'two',
    respondent_label: 'two',
    is_guest: false,
    submitted_at: null,
    duration_seconds: 140,
    main_flower_code: 'lily',
    main_flower_title: 'Лилия',
    raw_scores_by_scale: { hs: 3 },
    z_scores_by_scale: { hs: -0.2 },
    answers_by_question: {},
  },
  {
    session_id: 's3',
    user_id: 'u3',
    username: 'three',
    respondent_label: 'three',
    is_guest: false,
    submitted_at: null,
    duration_seconds: 180,
    main_flower_code: 'lily',
    main_flower_title: 'Лилия',
    raw_scores_by_scale: { hs: 7 },
    z_scores_by_scale: { hs: 0.3 },
    answers_by_question: {},
  },
] as const;

describe('adminAnalytics helpers', () => {
  it('builds discrete raw-score histogram by scale', () => {
    const histogram = buildScaleHistogram([...respondents], 'hs');

    expect(histogram.find((bin) => bin.value === 3)?.count).toBe(2);
    expect(histogram.find((bin) => bin.value === 7)?.count).toBe(1);
  });

  it('builds z-score bins with stable counts', () => {
    const histogram = buildZScoreHistogram([...respondents], 'hs', 0.5);

    expect(histogram.reduce((total, bin) => total + bin.count, 0)).toBe(3);
    expect(histogram.some((bin) => bin.count > 0 && bin.label.includes('-0.5'))).toBe(true);
  });
});
