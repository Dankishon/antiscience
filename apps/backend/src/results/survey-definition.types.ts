export interface SurveyMetadataDefinition {
  code: string;
  version: number;
  title: string;
  description: string;
  algorithmVersion: string;
}

export interface FlowerDefinition {
  code: string;
  title: string;
  symbol: string;
  sortOrder: number;
}

export interface ScaleDefinition {
  code: string;
  title: string;
  flowerCode: string;
  sortOrder: number;
}

export interface QuestionDefinition {
  code: string;
  number: number;
  scaleCode: string;
  prompt: string;
}

export interface SurveyDefinition {
  survey: SurveyMetadataDefinition;
  flowers: FlowerDefinition[];
  scales: ScaleDefinition[];
  questions: QuestionDefinition[];
}
