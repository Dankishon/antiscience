import type {
  AdminQuestionMeta,
  AdminQuestionStat,
  AdminRespondentMatrixRow,
  AdminScaleMeta,
} from './api';

export function filterQuestionsByScale(
  questions: AdminQuestionMeta[],
  scaleCode: string | null,
): AdminQuestionMeta[] {
  if (!scaleCode) {
    return questions;
  }
  return questions.filter((question) => question.scale_code === scaleCode);
}

export function filterQuestionStatsByScale(
  stats: AdminQuestionStat[],
  scaleCode: string | null,
): AdminQuestionStat[] {
  if (!scaleCode) {
    return stats;
  }
  return stats.filter((item) => item.scale_code === scaleCode);
}

export function buildQuestionDistribution(
  respondents: AdminRespondentMatrixRow[],
  questionCode: string | null,
): Array<{ value: number; count: number }> {
  const counts = new Map<number, number>([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ]);

  if (!questionCode) {
    return Array.from(counts, ([value, count]) => ({ value, count }));
  }

  for (const respondent of respondents) {
    const value = respondent.answers_by_question[questionCode];
    if (typeof value === 'number') {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([value, count]) => ({ value, count }));
}

export function getScaleMeta(scales: AdminScaleMeta[], scaleCode: string | null): AdminScaleMeta | null {
  if (!scaleCode) {
    return null;
  }
  return scales.find((scale) => scale.scale_code === scaleCode) ?? null;
}

export function getTopRawScale(
  respondent: AdminRespondentMatrixRow,
  scales: AdminScaleMeta[],
): { scale: AdminScaleMeta | null; rawScore: number } {
  let winner: AdminScaleMeta | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const scale of scales) {
    const rawScore = respondent.raw_scores_by_scale[scale.scale_code] ?? 0;
    if (rawScore > bestScore) {
      bestScore = rawScore;
      winner = scale;
    }
  }

  return {
    scale: winner,
    rawScore: Number.isFinite(bestScore) ? bestScore : 0,
  };
}
