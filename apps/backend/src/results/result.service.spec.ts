import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ComputeResultAuditLogDto } from './dto/compute-result.dto';
import type { RandomService } from './random.service';
import { ResultService } from './result.service';
import type { SurveyCatalogService } from './survey-catalog.service';
import type { SurveyDefinition } from './survey-definition.types';
import type { TieBreakAuditService } from './tie-break-audit.service';

function buildSurveyDefinition(): SurveyDefinition {
  const scales = [
    { code: 'hs', title: 'Ипохондрия', flowerCode: 'lily', sortOrder: 1 },
    { code: 'd', title: 'Депрессия', flowerCode: 'chrysanthemum', sortOrder: 2 },
    { code: 'hy', title: 'Истерия', flowerCode: 'gerbera', sortOrder: 3 },
    { code: 'pd', title: 'Психопатия', flowerCode: 'tulip', sortOrder: 4 },
    { code: 'mf_f', title: 'Феминность', flowerCode: 'rose', sortOrder: 5 },
    { code: 'mf_m', title: 'Маскулинность', flowerCode: 'cactus', sortOrder: 6 },
    { code: 'pa', title: 'Паранойя', flowerCode: 'cereus', sortOrder: 7 },
    { code: 'pt', title: 'Психастения', flowerCode: 'orchid', sortOrder: 8 },
    { code: 'sc', title: 'Шизофрения', flowerCode: 'iris', sortOrder: 9 },
    { code: 'ma', title: 'Мания', flowerCode: 'sunflower', sortOrder: 10 },
  ];

  const flowers = [
    { code: 'lily', title: 'Лилия', symbol: '⚜️', sortOrder: 1 },
    { code: 'chrysanthemum', title: 'Хризантема', symbol: '🌸', sortOrder: 2 },
    { code: 'gerbera', title: 'Гербера', symbol: '🌺', sortOrder: 3 },
    { code: 'tulip', title: 'Тюльпан', symbol: '🌷', sortOrder: 4 },
    { code: 'rose', title: 'Роза', symbol: '🌹', sortOrder: 5 },
    { code: 'cactus', title: 'Кактус', symbol: '🌵', sortOrder: 6 },
    { code: 'cereus', title: 'Цереус', symbol: '🌙', sortOrder: 7 },
    { code: 'orchid', title: 'Орхидея', symbol: '🦋', sortOrder: 8 },
    { code: 'iris', title: 'Ирис', symbol: '🌈', sortOrder: 9 },
    { code: 'sunflower', title: 'Подсолнух', symbol: '🌻', sortOrder: 10 },
  ];

  const questions = scales.flatMap((scale, scaleIndex) =>
    Array.from({ length: 3 }, (_, offset) => ({
      code: `${scale.code}_${String(offset + 1).padStart(2, '0')}`,
      number: scaleIndex * 3 + offset + 1,
      scaleCode: scale.code,
      prompt: `Question ${scale.code}_${offset + 1}`,
    })),
  );

  return {
    survey: {
      code: 'flower-soul-profile',
      version: 1,
      title: 'Flower Soul Profile',
      description: 'Unit-test definition',
      algorithmVersion: 'v1',
    },
    flowers,
    scales,
    questions,
  };
}

class FakeSurveyCatalogService {
  constructor(private readonly definition: SurveyDefinition) {}

  async getSurveyDefinition(): Promise<SurveyDefinition> {
    return this.definition;
  }
}

class FakeTieBreakAuditService {
  public readonly entries: ComputeResultAuditLogDto[] = [];

  async record(entry: ComputeResultAuditLogDto): Promise<void> {
    this.entries.push(entry);
  }
}

class FixedRandomService {
  constructor(private readonly sample: number) {}

  next(): number {
    return this.sample;
  }
}

function distributeRawScore(rawScore: number): number[] {
  const values = [0, 0, 0];
  let remaining = rawScore;

  for (let index = 0; index < values.length; index += 1) {
    const value = Math.min(4, remaining);
    values[index] = value;
    remaining -= value;
  }

  return values;
}

function buildAnswersForRawScores(definition: SurveyDefinition, rawScores: number[]) {
  return definition.scales.flatMap((scale, index) => {
    const rawScore = rawScores[index];
    if (typeof rawScore !== 'number') {
      throw new Error(`Missing raw score for scale ${scale.code}.`);
    }

    const values = distributeRawScore(rawScore);

    return definition.questions
      .filter((question) => question.scaleCode === scale.code)
      .sort((left, right) => left.number - right.number)
      .map((question, questionIndex) => {
        const value = values[questionIndex];
        if (typeof value !== 'number') {
          throw new Error(`Missing value for question ${question.code}.`);
        }

        return {
          questionCode: question.code,
          value,
        };
      });
  });
}

describe('ResultService', () => {
  it('computes a unique main flower without tie-break', async () => {
    const definition = buildSurveyDefinition();
    const surveyCatalog = new FakeSurveyCatalogService(definition) as unknown as SurveyCatalogService;
    const auditService = new FakeTieBreakAuditService() as unknown as TieBreakAuditService;
    const randomService = new FixedRandomService(0.2) as unknown as RandomService;
    const service = new ResultService(surveyCatalog, auditService, randomService);

    const result = await service.computeResult(
      buildAnswersForRawScores(definition, [12, 10, 9, 8, 7, 6, 5, 4, 3, 2]),
    );

    expect(result.mainFlower.flowerCode).toBe('lily');
    expect(result.tieBreak.applied).toBe(false);
    expect(result.tieBreak.strategy).toBe('none');
    expect(result.auditLog).toBeNull();
    expect(result.scaleResults).toHaveLength(10);
    expect(result.scaleResults[0]?.flowerCode).toBe('lily');
    expect(result.mean).toBeCloseTo(6.6, 6);
    expect(result.standardDeviation).toBeGreaterThan(0);
  });

  it('uses random_among_top when multiple flowers share the highest Z score', async () => {
    const definition = buildSurveyDefinition();
    const surveyCatalog = new FakeSurveyCatalogService(definition) as unknown as SurveyCatalogService;
    const auditService = new FakeTieBreakAuditService();
    const randomService = new FixedRandomService(0.6) as unknown as RandomService;
    const service = new ResultService(
      surveyCatalog,
      auditService as unknown as TieBreakAuditService,
      randomService,
    );

    const result = await service.computeResult(
      buildAnswersForRawScores(definition, [12, 12, 8, 7, 6, 5, 4, 3, 2, 1]),
      {
        auditEntityType: 'response_session',
        auditEntityId: 'session-123',
        actorUserId: 'user-456',
      },
    );

    expect(result.tieBreak.applied).toBe(true);
    expect(result.tieBreak.strategy).toBe('random_among_top');
    expect(result.tieBreak.reason).toBe('top_z_tie');
    expect(result.tieBreak.candidateFlowerCodes).toEqual(['lily', 'chrysanthemum']);
    expect(result.mainFlower.flowerCode).toBe('chrysanthemum');
    expect(result.auditLog?.metadata.selectedFlowerCode).toBe('chrysanthemum');
    expect(result.auditLog?.entityType).toBe('response_session');
    expect(result.auditLog?.entityId).toBe('session-123');
    expect(result.auditLog?.actorUserId).toBe('user-456');
    expect(result.auditLog?.metadata.surveyCode).toBe('flower-soul-profile');
    expect(result.auditLog?.metadata.surveyVersion).toBe(1);
    expect(result.auditLog?.metadata.algorithmVersion).toBe('v1');
    expect(auditService.entries).toHaveLength(1);
  });

  it('uses random_among_all and sets all Z scores to 0 when SD is 0', async () => {
    const definition = buildSurveyDefinition();
    const surveyCatalog = new FakeSurveyCatalogService(definition) as unknown as SurveyCatalogService;
    const auditService = new FakeTieBreakAuditService();
    const randomService = new FixedRandomService(0.51) as unknown as RandomService;
    const service = new ResultService(
      surveyCatalog,
      auditService as unknown as TieBreakAuditService,
      randomService,
    );

    const result = await service.computeResult(
      buildAnswersForRawScores(definition, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
    );

    expect(result.standardDeviation).toBe(0);
    expect(result.scaleResults.every((scale) => scale.zScore === 0)).toBe(true);
    expect(result.tieBreak.strategy).toBe('random_among_all');
    expect(result.tieBreak.reason).toBe('sd_zero');
    expect(result.mainFlower.flowerCode).toBe('cactus');
    expect(result.auditLog?.metadata.randomIndex).toBe(5);
    expect(auditService.entries).toHaveLength(1);
  });

  it('rejects incomplete payloads and values outside [0..4]', async () => {
    const definition = buildSurveyDefinition();
    const surveyCatalog = new FakeSurveyCatalogService(definition) as unknown as SurveyCatalogService;
    const auditService = new FakeTieBreakAuditService() as unknown as TieBreakAuditService;
    const randomService = new FixedRandomService(0.1) as unknown as RandomService;
    const service = new ResultService(surveyCatalog, auditService, randomService);
    const answers = buildAnswersForRawScores(definition, [12, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const invalidAnswers = answers.slice(1);
    invalidAnswers[0] = {
      questionCode: invalidAnswers[0]!.questionCode,
      value: 7,
    };

    await expect(service.computeResult(invalidAnswers)).rejects.toBeInstanceOf(BadRequestException);
  });
});
