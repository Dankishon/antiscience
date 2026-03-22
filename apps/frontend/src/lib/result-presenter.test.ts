import { describe, expect, it } from 'vitest';
import { buildResultViewModel, formatSignedNumber, resolveZLevel } from './result-presenter';
import type { ResultResponse } from './api';

function buildResult(): ResultResponse {
  return {
    responseId: 'response-123',
    surveyId: 'flower-soul-profile@1',
    status: 'submitted',
    submittedAt: '2026-03-22T18:45:00.000Z',
    result: {
      surveyCode: 'flower-soul-profile',
      surveyVersion: 1,
      algorithmVersion: 'v1',
      questionCount: 30,
      mean: 4.8,
      standardDeviation: 1.74,
      mainFlower: {
        scaleCode: 'hs',
        scaleTitle: 'Ипохондрия',
        flowerCode: 'lily',
        flowerTitle: 'Лилия',
        flowerSymbol: '⚜️',
        rawScore: 12,
        zScore: 2.34,
      },
      tieBreak: {
        applied: false,
        strategy: 'none',
        reason: null,
        candidateScaleCodes: [],
        candidateFlowerCodes: [],
        selectedScaleCode: 'hs',
        selectedFlowerCode: 'lily',
        randomIndex: null,
      },
      scaleResults: [
        {
          scaleCode: 'hs',
          scaleTitle: 'Ипохондрия',
          flowerCode: 'lily',
          flowerTitle: 'Лилия',
          flowerSymbol: '⚜️',
          questionCodes: ['hs_01', 'hs_02', 'hs_03'],
          questionNumbers: [1, 2, 3],
          answerValues: [4, 4, 4],
          rawScore: 12,
          zScore: 2.34,
          rank: 1,
          isMainFlower: true,
        },
        {
          scaleCode: 'd',
          scaleTitle: 'Депрессия',
          flowerCode: 'chrysanthemum',
          flowerTitle: 'Хризантема',
          flowerSymbol: '🌸',
          questionCodes: ['d_01', 'd_02', 'd_03'],
          questionNumbers: [4, 5, 6],
          answerValues: [1, 1, 1],
          rawScore: 3,
          zScore: -1.03,
          rank: 8,
          isMainFlower: false,
        },
        {
          scaleCode: 'hy',
          scaleTitle: 'Истерия',
          flowerCode: 'gerbera',
          flowerTitle: 'Гербера',
          flowerSymbol: '🌺',
          questionCodes: ['hy_01', 'hy_02', 'hy_03'],
          questionNumbers: [7, 8, 9],
          answerValues: [3, 3, 2],
          rawScore: 8,
          zScore: 1.12,
          rank: 2,
          isMainFlower: false,
        },
      ],
    },
  };
}

describe('result presenter', () => {
  it('formats signed Z scores for display', () => {
    expect(formatSignedNumber(1.234)).toBe('+1,23');
    expect(formatSignedNumber(-0.5)).toBe('-0,50');
    expect(formatSignedNumber(0)).toBe('0,00');
  });

  it('resolves Z-levels from the seed catalog', () => {
    expect(resolveZLevel(2.1)?.code).toBe('soul_flower');
    expect(resolveZLevel(0.4)?.code).toBe('shade');
    expect(resolveZLevel(-1.2)?.code).toBe('foreign_flower');
  });

  it('builds chart, table and interpretation view models from the API payload', () => {
    const payload = buildResult();
    const viewModel = buildResultViewModel(payload.result, payload.submittedAt);

    expect(viewModel.mainFlower.flowerTitle).toBe('Лилия');
    expect(viewModel.chart.labels[0]).toContain('Ипохондрия');
    expect(viewModel.profileRows[0]?.levelTitle).toBe('Цветок вашей души');
    expect(viewModel.profileRows[1]?.zScoreLabel).toBe('+1,12');
    expect(viewModel.interpretation.levelSummary).toContain('Вы — Лилия');
    expect(viewModel.highlights[0]?.flowerTitle).toBe('Гербера');
    expect(viewModel.submittedAtLabel).toBeTruthy();
  });
});
