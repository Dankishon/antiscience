export interface LikertOptionDefinition {
  value: number;
  label: string;
}

export interface SurveyMetadataDefinition {
  id?: string;
  code: string;
  version: number;
  title: string;
  description: string;
  algorithmVersion: string;
  instruction?: string;
  tieBreakStrategy?: string;
  likertScale?: LikertOptionDefinition[];
}

export interface FlowerDefinition {
  code: string;
  title: string;
  symbol: string;
  sortOrder: number;
  meaning?: string;
  rationale?: string;
  scaleCode?: string;
}

export interface ScaleDefinition {
  code: string;
  title: string;
  flowerCode: string;
  sortOrder: number;
  shortCode?: string;
  minScore?: number;
  maxScore?: number;
}

export interface QuestionDefinition {
  code: string;
  number: number;
  scaleCode: string;
  prompt: string;
  sortOrder?: number;
  weight?: number;
  minValue?: number;
  maxValue?: number;
  required?: boolean;
}

export interface SurveyDefinition {
  survey: SurveyMetadataDefinition;
  flowers: FlowerDefinition[];
  scales: ScaleDefinition[];
  questions: QuestionDefinition[];
}
