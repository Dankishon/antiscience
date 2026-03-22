import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FlowerDefinition,
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
  };
  flowers: Array<{
    code: string;
    title: string;
    symbol: string;
    sortOrder: number;
  }>;
  scales: Array<{
    code: string;
    title: string;
    flowerCode: string;
    sortOrder: number;
  }>;
  questions: Array<{
    code: string;
    number: number;
    scaleCode: string;
    prompt: string;
  }>;
}

@Injectable()
export class SurveyCatalogService {
  private cache: SurveyDefinition | null = null;

  async getSurveyDefinition(code: string, version: number): Promise<SurveyDefinition> {
    const definition = await this.loadDefinition();

    if (definition.survey.code !== code || definition.survey.version !== version) {
      throw new NotFoundException(
        `Survey definition ${code}@${version} is not available in the local seed catalog.`,
      );
    }

    return definition;
  }

  private async loadDefinition(): Promise<SurveyDefinition> {
    if (this.cache) {
      return this.cache;
    }

    const filePath = path.join(process.cwd(), 'seeds', 'questions.v1.json');
    const fileContents = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(fileContents) as QuestionsSeedFile;

    const flowers: FlowerDefinition[] = parsed.flowers
      .map((flower) => ({
        code: flower.code,
        title: flower.title,
        symbol: flower.symbol,
        sortOrder: flower.sortOrder,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);

    const scales: ScaleDefinition[] = parsed.scales
      .map((scale) => ({
        code: scale.code,
        title: scale.title,
        flowerCode: scale.flowerCode,
        sortOrder: scale.sortOrder,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);

    const questions: QuestionDefinition[] = parsed.questions
      .map((question) => ({
        code: question.code,
        number: question.number,
        scaleCode: question.scaleCode,
        prompt: question.prompt,
      }))
      .sort((left, right) => left.number - right.number);

    this.cache = {
      survey: {
        code: parsed.survey.code,
        version: parsed.survey.version,
        title: parsed.survey.title,
        description: parsed.survey.description,
        algorithmVersion: parsed.survey.algorithmVersion,
      },
      flowers,
      scales,
      questions,
    };

    return this.cache;
  }
}
