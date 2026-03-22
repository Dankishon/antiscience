import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ApiErrorException } from '../common/api-error.exception';
import { SurveyCatalogService } from '../results/survey-catalog.service';
import type { SurveyDefinition } from '../results/survey-definition.types';
import { ResponsesStoreService } from '../responses/responses.store';
import { AdminContentStoreService } from './admin-content.store';
import type { AttachFlowerAssetDto } from './dto/attach-flower-asset.dto';
import type { UpdateAnonymousRetentionDto } from './dto/update-anonymous-retention.dto';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AdminService {
  private anonymousSessionRetentionDays = 30;
  private lastAnonymousCleanupAt: string | null = null;
  private lastAnonymousCleanupDeletedCount = 0;

  constructor(
    @Inject(AdminContentStoreService)
    private readonly adminContentStore: AdminContentStoreService,
    @Inject(AuditLogService)
    private readonly auditLog: AuditLogService,
    @Inject(ResponsesStoreService)
    private readonly responsesStore: ResponsesStoreService,
    @Inject(SurveyCatalogService)
    private readonly surveyCatalog: SurveyCatalogService,
  ) {}

  async publishSurveyVersion(surveyId: string, actorUserId: string, requestId: string | null) {
    const definition = await this.resolveSurveyDefinition(surveyId);
    const publication = this.adminContentStore.publishSurvey({
      surveyId: definition.survey.id ?? surveyId,
      surveyCode: definition.survey.code,
      surveyVersion: definition.survey.version,
      publishedByUserId: actorUserId,
    });

    this.auditLog.record({
      actorUserId,
      action: 'survey.publish',
      entityType: 'survey',
      entityId: publication.surveyId,
      requestId,
      metadata: {
        surveyCode: publication.surveyCode,
        surveyVersion: publication.surveyVersion,
        publishedAt: publication.publishedAt,
      },
    });

    return {
      surveyId: publication.surveyId,
      slug: publication.surveyCode,
      version: publication.surveyVersion,
      publishedAt: publication.publishedAt,
      status: 'active' as const,
    };
  }

  async attachFlowerAsset(
    surveyId: string,
    flowerCode: string,
    input: AttachFlowerAssetDto,
    actorUserId: string,
    requestId: string | null,
  ) {
    const definition = await this.resolveSurveyDefinition(surveyId);
    const flower = definition.flowers.find((candidate) => candidate.code === flowerCode);

    if (!flower) {
      throw new ApiErrorException(
        HttpStatus.NOT_FOUND,
        'flower_not_found',
        `Flower ${flowerCode} does not exist in survey ${surveyId}.`,
      );
    }

    const asset = this.adminContentStore.attachAsset({
      surveyId: definition.survey.id ?? surveyId,
      flowerCode,
      kind: input.kind,
      title: input.title ?? null,
      altText: input.altText ?? null,
      storageKey: input.storageKey,
      publicUrl: input.publicUrl ?? null,
      mimeType: input.mimeType,
      visibility: input.visibility,
      metadata: input.metadata ?? null,
      createdByUserId: actorUserId,
    });

    this.auditLog.record({
      actorUserId,
      action: 'flower.asset.attach',
      entityType: 'asset',
      entityId: asset.id,
      requestId,
      metadata: {
        surveyId: asset.surveyId,
        flowerCode: asset.flowerCode,
        storageKey: asset.storageKey,
        visibility: asset.visibility,
      },
    });

    return {
      ...asset,
      flowerTitle: flower.title,
      assetsForFlower: this.adminContentStore.listAssets(asset.surveyId, flowerCode).length,
    };
  }

  getAnonymousSessionRetentionPolicy() {
    return {
      retentionDays: this.anonymousSessionRetentionDays,
      lastCleanupAt: this.lastAnonymousCleanupAt,
      lastDeletedCount: this.lastAnonymousCleanupDeletedCount,
    };
  }

  updateAnonymousSessionRetentionPolicy(
    input: UpdateAnonymousRetentionDto,
    actorUserId: string,
    requestId: string | null,
  ) {
    this.anonymousSessionRetentionDays = input.retentionDays;

    this.auditLog.record({
      actorUserId,
      action: 'retention.anonymous_sessions.update',
      entityType: 'retention_policy',
      entityId: 'anonymous_sessions',
      requestId,
      metadata: {
        retentionDays: this.anonymousSessionRetentionDays,
      },
    });

    let deletedSessionsCount = 0;
    let cutoffAt: string | null = null;
    let cleanedAt: string | null = null;

    if (input.runCleanup) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.retentionDays);
      cutoffAt = cutoffDate.toISOString();

      deletedSessionsCount = this.responsesStore.deleteAnonymousOlderThan(cutoffAt).length;
      cleanedAt = new Date().toISOString();
      this.lastAnonymousCleanupAt = cleanedAt;
      this.lastAnonymousCleanupDeletedCount = deletedSessionsCount;

      this.auditLog.record({
        actorUserId,
        action: 'retention.anonymous_sessions.cleanup',
        entityType: 'response_session',
        entityId: 'anonymous_sessions',
        requestId,
        metadata: {
          retentionDays: input.retentionDays,
          cutoffAt,
          deletedSessionsCount,
          cleanedAt,
        },
      });
    }

    return {
      retentionDays: this.anonymousSessionRetentionDays,
      cleanup: {
        executed: Boolean(input.runCleanup),
        cutoffAt,
        deletedSessionsCount,
        lastCleanupAt: this.lastAnonymousCleanupAt,
      },
    };
  }

  private async resolveSurveyDefinition(surveyId: string): Promise<SurveyDefinition> {
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
}
