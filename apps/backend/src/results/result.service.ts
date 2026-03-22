import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  ComputeResultAnswerDto,
  ComputeResultAuditLogDto,
  ComputeResultDto,
  ComputeResultOptionsDto,
  MainFlowerResultDto,
  ResultTieBreakDto,
  ScaleResultDto,
} from './dto/compute-result.dto';
import { RandomService } from './random.service';
import { SurveyCatalogService } from './survey-catalog.service';
import type { SurveyDefinition } from './survey-definition.types';
import { TieBreakAuditService } from './tie-break-audit.service';

const DEFAULT_SURVEY_CODE = 'flower-soul-profile';
const DEFAULT_SURVEY_VERSION = 1;
const SCALE_COUNT = 10;
const QUESTIONS_PER_SCALE = 3;
const MIN_ANSWER_VALUE = 0;
const MAX_ANSWER_VALUE = 4;
const FLOAT_TIE_EPSILON = 1e-9;

@Injectable()
export class ResultService {
  constructor(
    @Inject(SurveyCatalogService)
    private readonly surveyCatalog: SurveyCatalogService,
    @Inject(TieBreakAuditService)
    private readonly tieBreakAudit: TieBreakAuditService,
    @Inject(RandomService)
    private readonly randomService: RandomService,
  ) {}

  async computeResult(
    answers: ComputeResultAnswerDto[],
    options: ComputeResultOptionsDto = {},
  ): Promise<ComputeResultDto> {
    const surveyCode = options.surveyCode ?? DEFAULT_SURVEY_CODE;
    const surveyVersion = options.surveyVersion ?? DEFAULT_SURVEY_VERSION;
    const definition = await this.surveyCatalog.getSurveyDefinition(surveyCode, surveyVersion);
    const answersByCode = this.validateAndNormalizeAnswers(definition, answers);

    const scaleResults = definition.scales.map((scale) => {
      const questions = definition.questions
        .filter((question) => question.scaleCode === scale.code)
        .sort((left, right) => left.number - right.number);

      if (questions.length !== QUESTIONS_PER_SCALE) {
        throw new InternalServerErrorException(
          `Scale ${scale.code} must contain exactly ${QUESTIONS_PER_SCALE} questions.`,
        );
      }

      const flower = definition.flowers.find((candidate) => candidate.code === scale.flowerCode);
      if (!flower) {
        throw new InternalServerErrorException(
          `Flower ${scale.flowerCode} is missing for scale ${scale.code}.`,
        );
      }

      const answerValues = questions.map((question) => answersByCode.get(question.code)!);
      const rawScore = answerValues.reduce((sum, value) => sum + value, 0);

      return {
        scaleCode: scale.code,
        scaleTitle: scale.title,
        flowerCode: flower.code,
        flowerTitle: flower.title,
        flowerSymbol: flower.symbol,
        questionCodes: questions.map((question) => question.code),
        questionNumbers: questions.map((question) => question.number),
        answerValues,
        rawScore,
      };
    });

    if (scaleResults.length !== SCALE_COUNT) {
      throw new InternalServerErrorException(
        `Expected ${SCALE_COUNT} scales, received ${scaleResults.length}.`,
      );
    }

    const mean = scaleResults.reduce((sum, scale) => sum + scale.rawScore, 0) / scaleResults.length;
    const variance =
      scaleResults.reduce((sum, scale) => sum + (scale.rawScore - mean) ** 2, 0) / scaleResults.length;
    const standardDeviation = Math.sqrt(variance);

    const zScoredResults = scaleResults.map((scale) => ({
      ...scale,
      zScore: standardDeviation === 0 ? 0 : (scale.rawScore - mean) / standardDeviation,
    }));

    const mainFlowerSelection = this.selectMainFlower(
      definition,
      zScoredResults,
      standardDeviation,
      options,
    );
    const rankedResults = this.rankScaleResults(
      zScoredResults,
      mainFlowerSelection.mainFlower.flowerCode,
      mainFlowerSelection.mainFlower.scaleCode,
    );

    if (mainFlowerSelection.auditLog) {
      await this.tieBreakAudit.record(mainFlowerSelection.auditLog);
    }

    return {
      surveyCode: definition.survey.code,
      surveyVersion: definition.survey.version,
      algorithmVersion: definition.survey.algorithmVersion,
      questionCount: definition.questions.length,
      mean,
      standardDeviation,
      mainFlower: mainFlowerSelection.mainFlower,
      tieBreak: mainFlowerSelection.tieBreak,
      scaleResults: rankedResults,
      auditLog: mainFlowerSelection.auditLog,
    };
  }

  private validateAndNormalizeAnswers(
    definition: SurveyDefinition,
    answers: ComputeResultAnswerDto[],
  ): Map<string, number> {
    const expectedQuestionCodes = new Set(definition.questions.map((question) => question.code));
    const answersByCode = new Map<string, number>();
    const duplicateQuestionCodes: string[] = [];
    const unexpectedQuestionCodes: string[] = [];
    const invalidValues: string[] = [];

    for (const answer of answers) {
      if (!expectedQuestionCodes.has(answer.questionCode)) {
        unexpectedQuestionCodes.push(answer.questionCode);
        continue;
      }

      if (answersByCode.has(answer.questionCode)) {
        duplicateQuestionCodes.push(answer.questionCode);
        continue;
      }

      if (
        !Number.isInteger(answer.value) ||
        answer.value < MIN_ANSWER_VALUE ||
        answer.value > MAX_ANSWER_VALUE
      ) {
        invalidValues.push(`${answer.questionCode}=${String(answer.value)}`);
        continue;
      }

      answersByCode.set(answer.questionCode, answer.value);
    }

    const missingQuestionCodes = definition.questions
      .map((question) => question.code)
      .filter((questionCode) => !answersByCode.has(questionCode));

    if (
      duplicateQuestionCodes.length > 0 ||
      unexpectedQuestionCodes.length > 0 ||
      invalidValues.length > 0 ||
      missingQuestionCodes.length > 0
    ) {
      throw new BadRequestException({
        message: 'All 30 answers are required and every value must be an integer in [0..4].',
        duplicateQuestionCodes,
        unexpectedQuestionCodes,
        invalidValues,
        missingQuestionCodes,
      });
    }

    return answersByCode;
  }

  private selectMainFlower(
    definition: SurveyDefinition,
    scaleResults: Array<Omit<ScaleResultDto, 'rank' | 'isMainFlower'>>,
    standardDeviation: number,
    options: ComputeResultOptionsDto,
  ): {
    mainFlower: MainFlowerResultDto;
    tieBreak: ResultTieBreakDto;
    auditLog: ComputeResultAuditLogDto | null;
  } {
    if (standardDeviation === 0) {
      return this.buildTieBreakSelection(
        definition,
        scaleResults,
        'random_among_all',
        'sd_zero',
        options,
      );
    }

    const maxZScore = Math.max(...scaleResults.map((scale) => scale.zScore));
    const topResults = scaleResults.filter(
      (scale) => Math.abs(scale.zScore - maxZScore) <= FLOAT_TIE_EPSILON,
    );

    if (topResults.length === 1) {
      const winner = topResults[0];
      if (!winner) {
        throw new InternalServerErrorException('Expected a winner for a single-result selection.');
      }

      return {
        mainFlower: {
          scaleCode: winner.scaleCode,
          scaleTitle: winner.scaleTitle,
          flowerCode: winner.flowerCode,
          flowerTitle: winner.flowerTitle,
          flowerSymbol: winner.flowerSymbol,
          rawScore: winner.rawScore,
          zScore: winner.zScore,
        },
        tieBreak: {
          applied: false,
          strategy: 'none',
          reason: null,
          candidateScaleCodes: [winner.scaleCode],
          candidateFlowerCodes: [winner.flowerCode],
          selectedScaleCode: winner.scaleCode,
          selectedFlowerCode: winner.flowerCode,
          randomIndex: null,
        },
        auditLog: null,
      };
    }

    return this.buildTieBreakSelection(
      definition,
      topResults,
      'random_among_top',
      'top_z_tie',
      options,
    );
  }

  private buildTieBreakSelection(
    definition: SurveyDefinition,
    candidates: Array<Omit<ScaleResultDto, 'rank' | 'isMainFlower'>>,
    strategy: 'random_among_top' | 'random_among_all',
    reason: 'top_z_tie' | 'sd_zero',
    options: ComputeResultOptionsDto,
  ): {
    mainFlower: MainFlowerResultDto;
    tieBreak: ResultTieBreakDto;
    auditLog: ComputeResultAuditLogDto;
  } {
    const randomIndex = this.randomIndex(candidates.length);
    const selected = candidates[randomIndex];
    if (!selected) {
      throw new InternalServerErrorException('Random selection did not produce a candidate.');
    }

    const tieBreak: ResultTieBreakDto = {
      applied: true,
      strategy,
      reason,
      candidateScaleCodes: candidates.map((candidate) => candidate.scaleCode),
      candidateFlowerCodes: candidates.map((candidate) => candidate.flowerCode),
      selectedScaleCode: selected.scaleCode,
      selectedFlowerCode: selected.flowerCode,
      randomIndex,
    };

    return {
      mainFlower: {
        scaleCode: selected.scaleCode,
        scaleTitle: selected.scaleTitle,
        flowerCode: selected.flowerCode,
        flowerTitle: selected.flowerTitle,
        flowerSymbol: selected.flowerSymbol,
        rawScore: selected.rawScore,
        zScore: selected.zScore,
      },
      tieBreak,
      auditLog: {
        action: 'compute_result_tie_break',
        entityType: options.auditEntityType ?? 'survey_result',
        entityId: options.auditEntityId ?? null,
        actorUserId: options.actorUserId ?? null,
        metadata: {
          surveyCode: definition.survey.code,
          surveyVersion: definition.survey.version,
          algorithmVersion: definition.survey.algorithmVersion,
          strategy,
          reason,
          candidateScaleCodes: tieBreak.candidateScaleCodes,
          candidateFlowerCodes: tieBreak.candidateFlowerCodes,
          selectedScaleCode: tieBreak.selectedScaleCode,
          selectedFlowerCode: tieBreak.selectedFlowerCode,
          randomIndex,
        },
      },
    };
  }

  private rankScaleResults(
    scaleResults: Array<Omit<ScaleResultDto, 'rank' | 'isMainFlower'>>,
    mainFlowerCode: string,
    mainScaleCode: string,
  ): ScaleResultDto[] {
    const sorted = [...scaleResults].sort((left, right) => {
      if (Math.abs(right.zScore - left.zScore) > FLOAT_TIE_EPSILON) {
        return right.zScore - left.zScore;
      }

      return (left.questionNumbers[0] ?? 0) - (right.questionNumbers[0] ?? 0);
    });

    return sorted.map((scale, index) => ({
      ...scale,
      rank: index + 1,
      isMainFlower: scale.flowerCode === mainFlowerCode && scale.scaleCode === mainScaleCode,
    }));
  }

  private randomIndex(length: number): number {
    if (length <= 0) {
      throw new InternalServerErrorException('Random selection requires at least one candidate.');
    }

    const sample = this.randomService.next();
    const normalized = Number.isFinite(sample) ? sample : 0;
    return Math.min(length - 1, Math.max(0, Math.floor(normalized * length)));
  }
}
