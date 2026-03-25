import type {
  AdminQuestionMeta,
  AdminQuestionStat,
  AdminRespondentMatrixRow,
  AdminScaleMeta,
} from './api';

export type HeatmapMode = 'raw' | 'z';

export interface ScaleBoxplotStat {
  scale_code: string;
  scale_name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

export interface HistogramBin {
  label: string;
  from: number;
  to: number;
  count: number;
}

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

export function getQuestionDistribution(
  stats: AdminQuestionStat[],
  questionCode: string | null,
): Array<{ value: number; count: number }> {
  if (!questionCode) {
    return Array.from({ length: 5 }, (_, value) => ({ value, count: 0 }));
  }

  const question = stats.find((item) => item.question_code === questionCode);
  if (!question) {
    return Array.from({ length: 5 }, (_, value) => ({ value, count: 0 }));
  }

  return question.distribution.map((bucket) => ({
    value: bucket.value,
    count: bucket.count,
  }));
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

export function buildScaleHistogram(
  respondents: AdminRespondentMatrixRow[],
  scaleCode: string | null,
): Array<{ value: number; count: number }> {
  const counts = new Map<number, number>();
  for (let value = 0; value <= 12; value += 1) {
    counts.set(value, 0);
  }

  if (!scaleCode) {
    return Array.from(counts, ([value, count]) => ({ value, count }));
  }

  for (const respondent of respondents) {
    const score = respondent.raw_scores_by_scale[scaleCode];
    if (typeof score === 'number') {
      counts.set(score, (counts.get(score) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([value, count]) => ({ value, count }));
}

export function buildZScoreHistogram(
  respondents: AdminRespondentMatrixRow[],
  scaleCode: string | null,
  binWidth = 0.5,
): HistogramBin[] {
  if (!scaleCode) {
    return [];
  }

  const values = respondents
    .map((respondent) => respondent.z_scores_by_scale[scaleCode])
    .filter((value): value is number => typeof value === 'number')
    .sort((left, right) => left - right);

  if (values.length === 0) {
    return [];
  }

  const minBound = Math.floor(values[0] / binWidth) * binWidth;
  const maxBound = Math.ceil(values[values.length - 1] / binWidth) * binWidth || minBound + binWidth;
  const safeMaxBound = maxBound > minBound ? maxBound : minBound + binWidth;
  const bucketCount = Math.max(1, Math.ceil((safeMaxBound - minBound) / binWidth));
  const bins = Array.from({ length: bucketCount }, (_, index) => {
    const from = minBound + index * binWidth;
    const to = from + binWidth;
    return {
      label: `${from.toFixed(1)} … ${to.toFixed(1)}`,
      from,
      to,
      count: 0,
    };
  });

  for (const value of values) {
    const rawIndex = Math.floor((value - minBound) / binWidth);
    const index = Math.min(Math.max(rawIndex, 0), bins.length - 1);
    bins[index].count += 1;
  }

  return bins;
}

function quantile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function buildScaleBoxplots(
  respondents: AdminRespondentMatrixRow[],
  scales: AdminScaleMeta[],
  mode: HeatmapMode,
): ScaleBoxplotStat[] {
  return scales.map((scale) => {
    const values = respondents
      .map((respondent) =>
        mode === 'raw'
          ? respondent.raw_scores_by_scale[scale.scale_code]
          : respondent.z_scores_by_scale[scale.scale_code],
      )
      .filter((value): value is number => typeof value === 'number')
      .sort((left, right) => left - right);

    if (values.length === 0) {
      return {
        scale_code: scale.scale_code,
        scale_name: scale.scale_name,
        min: 0,
        q1: 0,
        median: 0,
        q3: 0,
        max: 0,
        outliers: [],
      };
    }

    const q1 = quantile(values, 0.25);
    const median = quantile(values, 0.5);
    const q3 = quantile(values, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - iqr * 1.5;
    const upperFence = q3 + iqr * 1.5;
    const inliers = values.filter((value) => value >= lowerFence && value <= upperFence);
    const outliers = values.filter((value) => value < lowerFence || value > upperFence);

    return {
      scale_code: scale.scale_code,
      scale_name: scale.scale_name,
      min: inliers[0] ?? values[0],
      q1,
      median,
      q3,
      max: inliers[inliers.length - 1] ?? values[values.length - 1],
      outliers,
    };
  });
}

export function buildQuestionHeatmapRows(
  respondents: AdminRespondentMatrixRow[],
  questions: AdminQuestionMeta[],
) {
  return respondents.map((respondent) => ({
    session_id: respondent.session_id,
    respondent_label: respondent.respondent_label,
    values: questions.map((question) => ({
      question_code: question.question_code,
      value: respondent.answers_by_question[question.question_code],
    })),
  }));
}

export function buildScaleHeatmapRows(
  respondents: AdminRespondentMatrixRow[],
  scales: AdminScaleMeta[],
  mode: HeatmapMode,
) {
  return respondents.map((respondent) => ({
    session_id: respondent.session_id,
    respondent_label: respondent.respondent_label,
    values: scales.map((scale) => ({
      scale_code: scale.scale_code,
      scale_name: scale.scale_name,
      value:
        mode === 'raw'
          ? respondent.raw_scores_by_scale[scale.scale_code]
          : respondent.z_scores_by_scale[scale.scale_code],
    })),
  }));
}

export function getHeatmapIntensity(value: number | null | undefined, mode: HeatmapMode): number {
  if (typeof value !== 'number') {
    return 0;
  }

  if (mode === 'raw') {
    return Math.max(0.08, Math.min(1, value / 12));
  }

  return Math.max(0.08, Math.min(1, Math.abs(value) / 3));
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) {
    return 'Не указана';
  }

  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes === 0) {
    return `${restSeconds} сек`;
  }
  return `${minutes} мин ${restSeconds.toString().padStart(2, '0')} сек`;
}
