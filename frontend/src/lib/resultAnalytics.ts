import type { ResultPayload } from './api';

type ScaleScore = ResultPayload['scale_scores'][number];

function byRank(left: ScaleScore, right: ScaleScore): number {
  return left.rank - right.rank || right.raw_score - left.raw_score || right.z_score - left.z_score;
}

function byRawScore(left: ScaleScore, right: ScaleScore): number {
  return right.raw_score - left.raw_score || right.z_score - left.z_score || left.rank - right.rank;
}

export function getRankedScaleScores(result: ResultPayload): ScaleScore[] {
  return [...result.scale_scores].sort(byRank);
}

export function getRawSortedScaleScores(result: ResultPayload): ScaleScore[] {
  return [...result.scale_scores].sort(byRawScore);
}

export function buildRadarProfileData(result: ResultPayload) {
  return getRankedScaleScores(result).map((item) => ({
    scaleCode: item.scale_code,
    flowerCode: item.flower_code,
    flowerTitle: item.flower_title,
    label: item.flower_title,
    rawScore: item.raw_score,
    zScore: item.z_score,
  }));
}

export function buildRawExpressionData(result: ResultPayload) {
  return getRawSortedScaleScores(result).map((item) => ({
    scaleCode: item.scale_code,
    flowerTitle: item.flower_title,
    flowerSymbol: item.flower_symbol,
    rawScore: item.raw_score,
    zScore: item.z_score,
  }));
}

export function getTopFlowers(result: ResultPayload, limit = 3): ScaleScore[] {
  return getRankedScaleScores(result).slice(0, limit);
}
