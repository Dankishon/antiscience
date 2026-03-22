import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiErrorException } from '../common/api-error.exception';
import type { ComputeResultAnswerDto } from '../results/dto/compute-result.dto';
import { ResultService } from '../results/result.service';
import { SurveyCatalogService } from '../results/survey-catalog.service';
import type { SurveyDefinition } from '../results/survey-definition.types';
import type { CreateResponseDto } from './dto/create-response.dto';
import type { ResponseAnswerInputDto, UpdateAnswersDto } from './dto/update-answers.dto';
import { ResponsesStoreService } from './responses.store';
import type { StoredResponseSession } from './responses.types';

@Injectable()
export class ResponsesService {
  constructor(
    @Inject(ResponsesStoreService)
    private readonly responsesStore: ResponsesStoreService,
    @Inject(SurveyCatalogService)
    private readonly surveyCatalog: SurveyCatalogService,
    @Inject(ResultService)
    private readonly resultService: ResultService,
  ) {}

  async createResponse(input: CreateResponseDto, actorUserId: string | null) {
    const definition = await this.getSurveyByIdOrThrow(input.surveyId);
    const now = new Date().toISOString();
    const session: StoredResponseSession = {
      id: randomUUID(),
      surveyId: definition.survey.id ?? this.surveyCatalog.buildSurveyId(definition.survey.code, definition.survey.version),
      surveyCode: definition.survey.code,
      surveyVersion: definition.survey.version,
      userId: actorUserId,
      status: 'in_progress',
      answers: new Map(),
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      result: null,
    };

    this.responsesStore.create(session);
    return this.serializeSession(session, definition.questions.length);
  }

  async updateAnswers(id: string, input: UpdateAnswersDto, actorUserId: string | null) {
    const session = await this.getAuthorizedSession(id, actorUserId);
    this.ensureResponseIsMutable(session);

    const definition = await this.getSurveyDefinitionForSession(session);
    this.validateAnswerBatch(input.answers, definition);

    for (const answer of input.answers) {
      session.answers.set(answer.questionCode, answer.value);
    }

    session.updatedAt = new Date().toISOString();
    this.responsesStore.save(session);

    return {
      ...this.serializeSession(session, definition.questions.length),
      savedAnswersCount: input.answers.length,
    };
  }

  async submitResponse(id: string, actorUserId: string | null) {
    const session = await this.getAuthorizedSession(id, actorUserId);
    this.ensureResponseIsMutable(session);

    const definition = await this.getSurveyDefinitionForSession(session);
    const answers = this.toAnswerList(session);

    try {
      const result = await this.resultService.computeResult(answers, {
        surveyCode: session.surveyCode,
        surveyVersion: session.surveyVersion,
        auditEntityType: 'response_session',
        auditEntityId: session.id,
        actorUserId,
      });

      session.status = 'submitted';
      session.result = result;
      session.submittedAt = new Date().toISOString();
      session.updatedAt = session.submittedAt;
      this.responsesStore.save(session);

      return {
        ...this.serializeSession(session, definition.questions.length),
        mainFlower: result.mainFlower,
        tieBreak: result.tieBreak,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'BadRequestException') {
        const errorWithResponse = error as unknown as { getResponse?: () => unknown };
        const response =
          typeof errorWithResponse.getResponse === 'function'
            ? errorWithResponse.getResponse()
            : null;
        const details =
          response && typeof response === 'object' && 'missingQuestionCodes' in response ? response : null;

        throw new ApiErrorException(
          HttpStatus.BAD_REQUEST,
          'response_incomplete',
          'All 30 required answers must be provided before submission.',
          details,
        );
      }

      throw error;
    }
  }

  async getResult(id: string, actorUserId: string | null) {
    const session = await this.getAuthorizedSession(id, actorUserId);
    if (!session.result) {
      throw new ApiErrorException(
        HttpStatus.CONFLICT,
        'result_not_ready',
        'The response session has not been submitted yet.',
      );
    }

    return {
      responseId: session.id,
      surveyId: session.surveyId,
      status: session.status,
      submittedAt: session.submittedAt,
      result: session.result,
    };
  }

  private async getAuthorizedSession(id: string, actorUserId: string | null): Promise<StoredResponseSession> {
    const session = this.responsesStore.getById(id);

    if (!session) {
      throw new ApiErrorException(HttpStatus.NOT_FOUND, 'response_not_found', `Response session ${id} does not exist.`);
    }

    if (session.userId && session.userId !== actorUserId) {
      throw new ApiErrorException(
        HttpStatus.FORBIDDEN,
        'forbidden',
        'Only the owner of this response session can access it.',
      );
    }

    return session;
  }

  private ensureResponseIsMutable(session: StoredResponseSession): void {
    if (session.status === 'submitted') {
      throw new ApiErrorException(
        HttpStatus.CONFLICT,
        'response_already_submitted',
        'The response session has already been submitted.',
      );
    }
  }

  private async getSurveyByIdOrThrow(surveyId: string): Promise<SurveyDefinition> {
    try {
      return await this.surveyCatalog.getSurveyDefinitionById(surveyId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ApiErrorException(
          HttpStatus.NOT_FOUND,
          'survey_not_found',
          `Survey ${surveyId} does not exist.`,
        );
      }

      throw error;
    }
  }

  private async getSurveyDefinitionForSession(session: StoredResponseSession): Promise<SurveyDefinition> {
    return this.surveyCatalog.getSurveyDefinition(session.surveyCode, session.surveyVersion);
  }

  private validateAnswerBatch(answers: ResponseAnswerInputDto[], definition: SurveyDefinition): void {
    const validQuestionCodes = new Set(definition.questions.map((question) => question.code));
    const seen = new Set<string>();
    const duplicateQuestionCodes: string[] = [];
    const unknownQuestionCodes: string[] = [];

    for (const answer of answers) {
      if (seen.has(answer.questionCode)) {
        duplicateQuestionCodes.push(answer.questionCode);
      }

      seen.add(answer.questionCode);

      if (!validQuestionCodes.has(answer.questionCode)) {
        unknownQuestionCodes.push(answer.questionCode);
      }
    }

    if (duplicateQuestionCodes.length > 0 || unknownQuestionCodes.length > 0) {
      throw new ApiErrorException(
        HttpStatus.BAD_REQUEST,
        'invalid_answers',
        'The answer batch contains invalid question references.',
        {
          duplicateQuestionCodes,
          unknownQuestionCodes,
        },
      );
    }
  }

  private toAnswerList(session: StoredResponseSession): ComputeResultAnswerDto[] {
    return Array.from(session.answers.entries()).map(([questionCode, value]) => ({
      questionCode,
      value,
    }));
  }

  private serializeSession(session: StoredResponseSession, totalQuestions: number) {
    return {
      id: session.id,
      surveyId: session.surveyId,
      surveySlug: session.surveyCode,
      surveyVersion: session.surveyVersion,
      userId: session.userId,
      status: session.status,
      answeredCount: session.answers.size,
      totalQuestions,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      submittedAt: session.submittedAt,
    };
  }
}
