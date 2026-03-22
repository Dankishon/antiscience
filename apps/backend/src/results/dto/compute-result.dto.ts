export type ResultTieBreakStrategy = 'none' | 'random_among_top' | 'random_among_all';

export type ResultTieBreakReason = 'top_z_tie' | 'sd_zero' | null;

export interface ComputeResultAnswerDto {
  questionCode: string;
  value: number;
}

export interface ComputeResultOptionsDto {
  surveyCode?: string;
  surveyVersion?: number;
  auditEntityType?: string;
  auditEntityId?: string | null;
  actorUserId?: string | null;
}

export interface ScaleResultDto {
  scaleCode: string;
  scaleTitle: string;
  flowerCode: string;
  flowerTitle: string;
  flowerSymbol: string;
  questionCodes: string[];
  questionNumbers: number[];
  answerValues: number[];
  rawScore: number;
  zScore: number;
  rank: number;
  isMainFlower: boolean;
}

export interface MainFlowerResultDto {
  scaleCode: string;
  scaleTitle: string;
  flowerCode: string;
  flowerTitle: string;
  flowerSymbol: string;
  rawScore: number;
  zScore: number;
}

export interface ResultTieBreakDto {
  applied: boolean;
  strategy: ResultTieBreakStrategy;
  reason: ResultTieBreakReason;
  candidateScaleCodes: string[];
  candidateFlowerCodes: string[];
  selectedScaleCode: string;
  selectedFlowerCode: string;
  randomIndex: number | null;
}

export interface ComputeResultAuditLogDto {
  action: 'compute_result_tie_break';
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  metadata: {
    surveyCode: string;
    surveyVersion: number;
    algorithmVersion: string;
    strategy: Exclude<ResultTieBreakStrategy, 'none'>;
    reason: Exclude<ResultTieBreakReason, null>;
    candidateScaleCodes: string[];
    candidateFlowerCodes: string[];
    selectedScaleCode: string;
    selectedFlowerCode: string;
    randomIndex: number;
  };
}

export interface ComputeResultDto {
  surveyCode: string;
  surveyVersion: number;
  algorithmVersion: string;
  questionCount: number;
  mean: number;
  standardDeviation: number;
  mainFlower: MainFlowerResultDto;
  tieBreak: ResultTieBreakDto;
  scaleResults: ScaleResultDto[];
  auditLog: ComputeResultAuditLogDto | null;
}
