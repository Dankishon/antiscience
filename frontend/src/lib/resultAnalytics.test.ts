import type { ResultPayload } from './api';
import { describe, expect, it } from 'vitest';
import { buildRawExpressionData } from './resultAnalytics';

const resultPayload: ResultPayload = {
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
    applied: false,
    strategy: 'single_top',
    candidate_flower_codes: ['lily'],
  },
  scale_scores: [
    {
      scale_code: 'hy',
      flower_code: 'rose',
      flower_title: 'Роза',
      flower_symbol: '✿',
      raw_score: 8,
      z_score: 0.6,
      rank: 3,
      z_level_code: null,
      z_level_title: null,
    },
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
      raw_score: 10,
      z_score: 1.7,
      rank: 2,
      z_level_code: null,
      z_level_title: null,
    },
  ],
  interpretation: {
    z_level_code: null,
    z_level_title: null,
    profile_title: null,
    profile_summary: null,
    profile_source_header: null,
    z_summary: null,
    traits: [],
  },
  submitted_at: '2026-03-25T08:30:00Z',
};

describe('resultAnalytics', () => {
  it('builds raw expression data sorted by descending raw score', () => {
    const chartData = buildRawExpressionData(resultPayload);

    expect(chartData).toHaveLength(3);
    expect(chartData.map((item) => item.flowerTitle)).toEqual(['Лилия', 'Хризантема', 'Роза']);
    expect(chartData.map((item) => item.rawScore)).toEqual([12, 10, 8]);
  });
});
