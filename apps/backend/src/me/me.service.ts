import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditLogService } from '../admin/audit-log.service';
import { ApiErrorException } from '../common/api-error.exception';
import { AuthStoreService } from '../auth/auth-store.service';
import type { AuthUserDto } from '../auth/auth.types';
import { ResponsesStoreService } from '../responses/responses.store';
import type { StoredResponseSession } from '../responses/responses.types';

@Injectable()
export class MeService {
  constructor(
    @Inject(AuditLogService)
    private readonly auditLog: AuditLogService,
    @Inject(AuthStoreService)
    private readonly authStore: AuthStoreService,
    @Inject(ResponsesStoreService)
    private readonly responsesStore: ResponsesStoreService,
  ) {}

  exportMyData(user: AuthUserDto) {
    const userRecord = this.authStore.findUserById(user.id);
    if (!userRecord) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'User account is not available.');
    }

    const responseSessions = this.responsesStore
      .listByUserId(user.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((session) => this.serializeResponseSession(session));

    const refreshTokens = this.authStore
      .listRefreshTokensByUserId(user.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((token) => ({
        id: token.id,
        familyId: token.familyId,
        userAgent: token.userAgent,
        ipAddress: token.ipAddress,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        rotatedAt: token.rotatedAt,
        lastUsedAt: token.lastUsedAt,
        replacedByTokenId: token.replacedByTokenId,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      }));

    const auditEntries = this.auditLog
      .listByActorUserId(user.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      user,
      auth: {
        refreshTokens,
      },
      responseSessions,
      auditLog: auditEntries,
    };
  }

  deleteMyData(user: AuthUserDto, requestId: string | null, reason?: string) {
    const deletedResponseSessions = this.responsesStore.deleteByUserId(user.id);
    const deletedRefreshTokensCount = this.authStore.deleteRefreshTokensByUserId(user.id);
    const anonymizedAuditEntriesCount = this.auditLog.anonymizeActorUser(user.id);
    const deletedUser = this.authStore.deleteUser(user.id);

    if (!deletedUser) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'User account is not available.');
    }

    const deletedAt = new Date().toISOString();
    const erasureRecord = this.auditLog.record({
      actorUserId: 'system',
      action: 'gdpr.user.delete',
      entityType: 'gdpr_erasure',
      entityId: randomUUID(),
      requestId,
      metadata: {
        deletedAt,
        deletedResponseSessionsCount: deletedResponseSessions.length,
        deletedRefreshTokensCount,
        anonymizedAuditEntriesCount,
        reason: reason ?? null,
      },
    });

    return {
      success: true,
      deletedAt,
      deletionAuditId: erasureRecord.id,
      deletedResponseSessionsCount: deletedResponseSessions.length,
      deletedRefreshTokensCount,
      anonymizedAuditEntriesCount,
    };
  }

  private serializeResponseSession(session: StoredResponseSession) {
    return {
      id: session.id,
      surveyId: session.surveyId,
      surveySlug: session.surveyCode,
      surveyVersion: session.surveyVersion,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      submittedAt: session.submittedAt,
      answers: Array.from(session.answers.entries()).map(([questionCode, value]) => ({
        questionCode,
        value,
      })),
      result: session.result,
    };
  }
}
