import interpretationsSeed from '../../../../seeds/interps.v1.json';
import type { ResultResponse } from './api';

type InterpretationCatalog = typeof interpretationsSeed;

type ResultPayload = ResultResponse['result'];

type ZLevelDefinition = InterpretationCatalog['zLevels'][number];
type ProfileDefinition = InterpretationCatalog['profiles'][number];

export type ResultChartMode = 'raw' | 'z';

export interface ResultProfileRow {
  rank: number;
  scaleCode: string;
  scaleTitle: string;
  flowerCode: string;
  flowerTitle: string;
  flowerSymbol: string;
  rawScore: number;
  rawScoreLabel: string;
  zScore: number;
  zScoreLabel: string;
  levelLabel: string;
  levelTitle: string;
  isMainFlower: boolean;
}

export interface ResultInterpretationViewModel {
  flowerCode: string;
  flowerTitle: string;
  symbol: string;
  baseSummary: string | null;
  levelLabel: string;
  levelTitle: string;
  levelDescription: string | null;
  levelSummary: string | null;
  traits: Array<{
    code: string;
    label: string;
    description: string;
    polarity: number;
  }>;
}

export interface ResultHighlightViewModel {
  flowerCode: string;
  flowerTitle: string;
  symbol: string;
  scaleTitle: string;
  zScoreLabel: string;
  summary: string | null;
}

export interface ResultViewModel {
  submittedAtLabel: string | null;
  meanLabel: string;
  standardDeviationLabel: string;
  tieBreakLabel: string;
  mainFlower: {
    flowerCode: string;
    flowerTitle: string;
    flowerSymbol: string;
    scaleTitle: string;
    summary: string;
  };
  chart: {
    labels: string[];
    rawValues: number[];
    zValues: number[];
    highlightIndex: number;
  };
  profileRows: ResultProfileRow[];
  interpretation: ResultInterpretationViewModel;
  highlights: ResultHighlightViewModel[];
}

const catalog = interpretationsSeed as InterpretationCatalog;

function getProfileDefinition(flowerCode: string): ProfileDefinition | undefined {
  return catalog.profiles.find((profile) => profile.flowerCode === flowerCode);
}

export function formatSignedNumber(value: number, maximumFractionDigits = 2) {
  const formatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits,
    signDisplay: 'exceptZero',
  });

  return formatter.format(value);
}

export function formatMetricNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value);
}

export function formatSubmittedAt(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function resolveZLevel(zScore: number): ZLevelDefinition | null {
  const scaledScore = Math.round(zScore * catalog.zScaleFactor);

  return (
    catalog.zLevels.find((level) => scaledScore >= level.zFrom && scaledScore <= level.zTo) ?? null
  );
}

function buildInterpretation(
  flowerCode: string,
  flowerTitle: string,
  symbol: string,
  zScore: number,
): ResultInterpretationViewModel {
  const profile = getProfileDefinition(flowerCode);
  const zLevel = resolveZLevel(zScore);
  const levelSummary =
    profile?.zInterpretations.find((interpretation) => interpretation.zLevelCode === zLevel?.code)?.summary ?? null;

  return {
    flowerCode,
    flowerTitle,
    symbol,
    baseSummary: profile?.profileInterpretation.summary ?? null,
    levelLabel: zLevel?.label ?? 'Без интерпретации',
    levelTitle: zLevel?.title ?? 'Без интерпретации',
    levelDescription: zLevel?.description ?? null,
    levelSummary,
    traits:
      profile?.traits.map((trait) => ({
        code: trait.code,
        label: trait.label,
        description: trait.description,
        polarity: trait.polarity,
      })) ?? [],
  };
}

export function buildResultViewModel(result: ResultPayload, submittedAt: string | null): ResultViewModel {
  const sortedRows = [...result.scaleResults].sort((left, right) => left.rank - right.rank);
  const mainFlower = result.mainFlower;
  const mainInterpretation = buildInterpretation(
    mainFlower.flowerCode,
    mainFlower.flowerTitle,
    mainFlower.flowerSymbol,
    mainFlower.zScore,
  );
  const highlights = sortedRows
    .filter((row) => row.flowerCode !== mainFlower.flowerCode)
    .slice(0, 3)
    .map((row) => {
      const interpretation = buildInterpretation(row.flowerCode, row.flowerTitle, row.flowerSymbol, row.zScore);

      return {
        flowerCode: row.flowerCode,
        flowerTitle: row.flowerTitle,
        symbol: row.flowerSymbol,
        scaleTitle: row.scaleTitle,
        zScoreLabel: formatSignedNumber(row.zScore),
        summary: interpretation.levelSummary ?? interpretation.baseSummary,
      };
    });

  return {
    submittedAtLabel: formatSubmittedAt(submittedAt),
    meanLabel: formatMetricNumber(result.mean),
    standardDeviationLabel: formatMetricNumber(result.standardDeviation),
    tieBreakLabel: result.tieBreak.strategy,
    mainFlower: {
      flowerCode: mainFlower.flowerCode,
      flowerTitle: mainFlower.flowerTitle,
      flowerSymbol: mainFlower.flowerSymbol,
      scaleTitle: mainFlower.scaleTitle,
      summary: mainInterpretation.levelSummary ?? mainInterpretation.baseSummary ?? mainFlower.scaleTitle,
    },
    chart: {
      labels: sortedRows.map((row) => `${row.flowerSymbol} ${row.scaleTitle}`),
      rawValues: sortedRows.map((row) => row.rawScore),
      zValues: sortedRows.map((row) => row.zScore),
      highlightIndex: sortedRows.findIndex((row) => row.flowerCode === mainFlower.flowerCode),
    },
    profileRows: sortedRows.map((row) => {
      const zLevel = resolveZLevel(row.zScore);

      return {
        rank: row.rank,
        scaleCode: row.scaleCode,
        scaleTitle: row.scaleTitle,
        flowerCode: row.flowerCode,
        flowerTitle: row.flowerTitle,
        flowerSymbol: row.flowerSymbol,
        rawScore: row.rawScore,
        rawScoreLabel: String(row.rawScore),
        zScore: row.zScore,
        zScoreLabel: formatSignedNumber(row.zScore),
        levelLabel: zLevel?.label ?? 'Без интерпретации',
        levelTitle: zLevel?.title ?? 'Без интерпретации',
        isMainFlower: row.isMainFlower,
      };
    }),
    interpretation: mainInterpretation,
    highlights,
  };
}
