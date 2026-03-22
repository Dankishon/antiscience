import { Readable } from 'node:stream';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiErrorException } from '../common/api-error.exception';
import { ResponsesStoreService } from '../responses/responses.store';
import { SurveyCatalogService } from '../results/survey-catalog.service';
import type { SurveyDefinition } from '../results/survey-definition.types';
import { AuditLogService } from './audit-log.service';

const DEFAULT_EXPORT_PAGE = 1;
const DEFAULT_EXPORT_LIMIT = 100;

interface ExportScaleScoreRow {
  scaleCode: string;
  scaleTitle: string;
  flowerCode: string;
  flowerTitle: string;
  rawX: number;
  z: number;
}

interface ExportAnalyticsItem {
  responseSession: {
    id: string;
    surveyId: string;
    surveyCode: string;
    surveyVersion: number;
    userId: string | null;
    createdAt: string;
    updatedAt: string;
    submittedAt: string;
  };
  computedResult: {
    mainFlowerCode: string;
    mainFlowerTitle: string;
    mean: number;
    standardDeviation: number;
    tieBreakStrategy: string;
  };
  scaleScores: ExportScaleScoreRow[];
}

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @Inject(AuditLogService)
    private readonly auditLog: AuditLogService,
    @Inject(ResponsesStoreService)
    private readonly responsesStore: ResponsesStoreService,
    @Inject(SurveyCatalogService)
    private readonly surveyCatalog: SurveyCatalogService,
  ) {}

  async getSummary(surveyId?: string) {
    const definition = await this.resolveSurveyDefinition(surveyId);
    const sessions = this.responsesStore
      .listAll()
      .filter(
        (session) =>
          session.surveyId === (definition.survey.id ?? surveyId) &&
          session.status === 'submitted' &&
          session.result,
      );

    const topFlowerCounts = new Map<string, number>();
    let tieBreakCount = 0;
    let meanAccumulator = 0;
    let standardDeviationAccumulator = 0;

    for (const session of sessions) {
      const result = session.result;
      if (!result) {
        continue;
      }

      topFlowerCounts.set(result.mainFlower.flowerCode, (topFlowerCounts.get(result.mainFlower.flowerCode) ?? 0) + 1);
      if (result.tieBreak.applied) {
        tieBreakCount += 1;
      }

      meanAccumulator += result.mean;
      standardDeviationAccumulator += result.standardDeviation;
    }

    const latestSubmissionAt = sessions
      .map((session) => session.submittedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    return {
      survey: {
        id: definition.survey.id,
        slug: definition.survey.code,
        version: definition.survey.version,
        title: definition.survey.title,
      },
      totals: {
        submittedResponses: sessions.length,
        anonymousResponses: sessions.filter((session) => !session.userId).length,
        identifiedResponses: sessions.filter((session) => Boolean(session.userId)).length,
        tieBreakCount,
      },
      averages: {
        mean: sessions.length > 0 ? meanAccumulator / sessions.length : 0,
        standardDeviation: sessions.length > 0 ? standardDeviationAccumulator / sessions.length : 0,
      },
      mainFlowers: definition.flowers.map((flower) => {
        const count = topFlowerCounts.get(flower.code) ?? 0;
        return {
          flowerCode: flower.code,
          flowerTitle: flower.title,
          count,
          share: sessions.length > 0 ? count / sessions.length : 0,
        };
      }),
      latestSubmissionAt,
    };
  }

  async exportAnalytics(
    actorUserId: string,
    requestId: string | null,
    options: {
      surveyId?: string;
      format?: 'json' | 'csv';
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<
    | {
        type: 'csv';
        contentType: string;
        fileName: string;
        headers: Record<string, string>;
        stream: Readable;
      }
    | {
        type: 'json';
        contentType: string;
        headers: Record<string, string>;
        body: ExportAnalyticsItem[];
      }
  > {
    const definition = await this.resolveSurveyDefinition(options.surveyId);
    const range = this.buildRange(options.from, options.to);
    const page = options.page ?? DEFAULT_EXPORT_PAGE;
    const limit = options.limit ?? DEFAULT_EXPORT_LIMIT;
    const items = this.buildExportItems(definition, range);
    const totalMatched = items.length;
    const pageStart = (page - 1) * limit;
    const pagedItems = items.slice(pageStart, pageStart + limit);

    this.auditLog.record({
      actorUserId,
      action: 'analytics.export',
      entityType: 'survey',
      entityId: definition.survey.id ?? definition.survey.code,
      requestId,
      metadata: {
        surveyId: definition.survey.id,
        format: options.format ?? 'json',
        from: options.from ?? null,
        to: options.to ?? null,
        page,
        limit,
        exportedRows: pagedItems.length,
        totalMatched,
      },
    });

    const headers = {
      'X-Export-Page': String(page),
      'X-Export-Limit': String(limit),
      'X-Export-Total-Matched': String(totalMatched),
    };

    if ((options.format ?? 'json') === 'csv') {
      return {
        type: 'csv',
        contentType: 'text/csv; charset=utf-8',
        fileName: buildExportFileName(definition.survey.code, page),
        headers,
        stream: Readable.from(this.generateCsvChunks(pagedItems)),
      };
    }

    return {
      type: 'json',
      contentType: 'application/json; charset=utf-8',
      headers,
      body: pagedItems,
    };
  }

  private async resolveSurveyDefinition(surveyId?: string): Promise<SurveyDefinition> {
    if (surveyId) {
      try {
        return await this.surveyCatalog.getSurveyDefinitionById(surveyId);
      } catch {
        throw new ApiErrorException(
          HttpStatus.NOT_FOUND,
          'survey_not_found',
          `Survey ${surveyId} does not exist.`,
        );
      }
    }

    return this.surveyCatalog.getDefaultSurveyDefinition();
  }

  private buildRange(from?: string, to?: string): { from: number | null; to: number | null } {
    const fromTimestamp = from ? new Date(from).getTime() : null;
    const toTimestamp = to ? new Date(to).getTime() : null;

    if (fromTimestamp !== null && toTimestamp !== null && fromTimestamp > toTimestamp) {
      throw new ApiErrorException(
        HttpStatus.BAD_REQUEST,
        'invalid_export_range',
        '`from` must be earlier than or equal to `to`.',
      );
    }

    return {
      from: fromTimestamp,
      to: toTimestamp,
    };
  }

  private buildExportItems(
    definition: SurveyDefinition,
    range: { from: number | null; to: number | null },
  ): ExportAnalyticsItem[] {
    return this.responsesStore
      .listAll()
      .filter(
        (session) =>
          session.surveyId === definition.survey.id &&
          session.status === 'submitted' &&
          session.result &&
          session.submittedAt &&
          isWithinRange(session.submittedAt, range),
      )
      .sort((left, right) => (left.submittedAt ?? '').localeCompare(right.submittedAt ?? ''))
      .map((session) => {
        const result = session.result;
        if (!result || !session.submittedAt) {
          throw new ApiErrorException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            'analytics_export_error',
            'Submitted response session is missing its computed result payload.',
          );
        }

        return {
          responseSession: {
            id: session.id,
            surveyId: session.surveyId,
            surveyCode: session.surveyCode,
            surveyVersion: session.surveyVersion,
            userId: session.userId,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            submittedAt: session.submittedAt,
          },
          computedResult: {
            mainFlowerCode: result.mainFlower.flowerCode,
            mainFlowerTitle: result.mainFlower.flowerTitle,
            mean: result.mean,
            standardDeviation: result.standardDeviation,
            tieBreakStrategy: result.tieBreak.strategy,
          },
          scaleScores: result.scaleResults.map((scale) => ({
            scaleCode: scale.scaleCode,
            scaleTitle: scale.scaleTitle,
            flowerCode: scale.flowerCode,
            flowerTitle: scale.flowerTitle,
            rawX: scale.rawScore,
            z: scale.zScore,
          })),
        };
      });
  }

  private *generateCsvChunks(items: ExportAnalyticsItem[]): Generator<string> {
    yield [
      'response_id',
      'survey_id',
      'survey_code',
      'survey_version',
      'user_id',
      'created_at',
      'updated_at',
      'submitted_at',
      'main_flower_code',
      'main_flower_title',
      'mean',
      'sd',
      'tie_break_strategy',
      'scale_code',
      'scale_title',
      'scale_flower_code',
      'scale_flower_title',
      'raw_x',
      'z',
    ].join(',');
    yield '\n';

    for (const item of items) {
      for (const scaleScore of item.scaleScores) {
        yield [
          escapeCsvValue(item.responseSession.id),
          escapeCsvValue(item.responseSession.surveyId),
          escapeCsvValue(item.responseSession.surveyCode),
          escapeCsvValue(String(item.responseSession.surveyVersion)),
          escapeCsvValue(item.responseSession.userId ?? ''),
          escapeCsvValue(item.responseSession.createdAt),
          escapeCsvValue(item.responseSession.updatedAt),
          escapeCsvValue(item.responseSession.submittedAt),
          escapeCsvValue(item.computedResult.mainFlowerCode),
          escapeCsvValue(item.computedResult.mainFlowerTitle),
          escapeCsvValue(String(item.computedResult.mean)),
          escapeCsvValue(String(item.computedResult.standardDeviation)),
          escapeCsvValue(item.computedResult.tieBreakStrategy),
          escapeCsvValue(scaleScore.scaleCode),
          escapeCsvValue(scaleScore.scaleTitle),
          escapeCsvValue(scaleScore.flowerCode),
          escapeCsvValue(scaleScore.flowerTitle),
          escapeCsvValue(String(scaleScore.rawX)),
          escapeCsvValue(String(scaleScore.z)),
        ].join(',');
        yield '\n';
      }
    }
  }
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function isWithinRange(
  value: string,
  range: {
    from: number | null;
    to: number | null;
  },
): boolean {
  const timestamp = new Date(value).getTime();
  if (range.from !== null && timestamp < range.from) {
    return false;
  }

  if (range.to !== null && timestamp > range.to) {
    return false;
  }

  return true;
}

function buildExportFileName(slug: string, page: number): string {
  return `${slug}-analytics-page-${String(page)}.csv`;
}
