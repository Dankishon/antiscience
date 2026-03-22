import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FlowerDefinition,
  LikertOptionDefinition,
  QuestionDefinition,
  ScaleDefinition,
  SurveyDefinition,
} from './survey-definition.types';

interface QuestionsSeedFile {
  survey: {
    code: string;
    version: number;
    title: string;
    description: string;
    algorithmVersion: string;
    instruction?: string;
    tieBreakStrategy?: string;
    likertScale?: LikertOptionDefinition[];
  };
  flowers: Array<{
    code: string;
    title: string;
    symbol: string;
    sortOrder: number;
    meaning?: string;
    rationale?: string;
    scaleCode?: string;
  }>;
  scales: Array<{
    code: string;
    title: string;
    flowerCode: string;
    sortOrder: number;
    shortCode?: string;
    minScore?: number;
    maxScore?: number;
  }>;
  questions: Array<{
    code: string;
    number: number;
    scaleCode: string;
    prompt: string;
    sortOrder?: number;
    weight?: number;
    minValue?: number;
    maxValue?: number;
    required?: boolean;
  }>;
}

@Injectable()
export class SurveyCatalogService {
  private cache: SurveyDefinition | null = null;

  buildSurveyId(code: string, version: number): string {
    return `${code}@${String(version)}`;
  }

  async getSurveyDefinition(code: string, version: number): Promise<SurveyDefinition> {
    const definition = await this.loadDefinition();

    if (definition.survey.code !== code || definition.survey.version !== version) {
      throw new NotFoundException(
        `Survey definition ${code}@${version} is not available in the local seed catalog.`,
      );
    }

    return definition;
  }

  async getActiveSurveyDefinition(slug: string): Promise<SurveyDefinition> {
    const definition = await this.loadDefinition();

    if (definition.survey.code !== slug) {
      throw new NotFoundException(`Active survey ${slug} is not available in the local seed catalog.`);
    }

    return definition;
  }

  async getDefaultSurveyDefinition(): Promise<SurveyDefinition> {
    return this.loadDefinition();
  }

  async getSurveyDefinitionById(id: string): Promise<SurveyDefinition> {
    const definition = await this.loadDefinition();

    if (definition.survey.id !== id) {
      throw new NotFoundException(`Survey definition ${id} is not available in the local seed catalog.`);
    }

    return definition;
  }

  private async loadDefinition(): Promise<SurveyDefinition> {
    if (this.cache) {
      return this.cache;
    }

    const fileContents = await this.readSeedFile();
    const parsed = JSON.parse(fileContents) as QuestionsSeedFile;

    const flowers: FlowerDefinition[] = parsed.flowers
      .map((flower) => ({
        code: flower.code,
        title: flower.title,
        symbol: flower.symbol,
        sortOrder: flower.sortOrder,
        meaning: flower.meaning,
        rationale: flower.rationale,
        scaleCode: flower.scaleCode,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);

    const scales: ScaleDefinition[] = parsed.scales
      .map((scale) => ({
        code: scale.code,
        title: scale.title,
        flowerCode: scale.flowerCode,
        sortOrder: scale.sortOrder,
        shortCode: scale.shortCode,
        minScore: scale.minScore,
        maxScore: scale.maxScore,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);

    const questions: QuestionDefinition[] = parsed.questions
      .map((question) => ({
        code: question.code,
        number: question.number,
        scaleCode: question.scaleCode,
        prompt: question.prompt,
        sortOrder: question.sortOrder,
        weight: question.weight,
        minValue: question.minValue,
        maxValue: question.maxValue,
        required: question.required,
      }))
      .sort((left, right) => left.number - right.number);

    this.cache = {
      survey: {
        id: this.buildSurveyId(parsed.survey.code, parsed.survey.version),
        code: parsed.survey.code,
        version: parsed.survey.version,
        title: parsed.survey.title,
        description: parsed.survey.description,
        algorithmVersion: parsed.survey.algorithmVersion,
        instruction: parsed.survey.instruction,
        tieBreakStrategy: parsed.survey.tieBreakStrategy,
        likertScale: parsed.survey.likertScale,
      },
      flowers,
      scales,
      questions,
    };

    return this.cache;
  }

  private async readSeedFile(): Promise<string> {
    const candidatePaths = [
      path.join(process.cwd(), 'seeds', 'questions.v1.json'),
      path.resolve(__dirname, '../../../../seeds/questions.v1.json'),
    ];

    for (const candidatePath of candidatePaths) {
      try {
        return await readFile(candidatePath, 'utf8');
      } catch (error) {
        const notFound =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code?: string }).code === 'ENOENT';

        if (!notFound) {
          throw error;
        }
      }
    }

    throw new NotFoundException('Survey seed file questions.v1.json could not be resolved.');
  }
}
