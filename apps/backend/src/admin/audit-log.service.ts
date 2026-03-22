import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuditLogRecord } from './admin.types';

interface CreateAuditLogInput {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly entries: AuditLogRecord[] = [];

  record(input: CreateAuditLogInput): AuditLogRecord {
    const entry: AuditLogRecord = {
      id: randomUUID(),
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? null,
      requestId: input.requestId ?? null,
      createdAt: new Date().toISOString(),
    };

    this.entries.push(entry);
    return entry;
  }

  list(): AuditLogRecord[] {
    return [...this.entries];
  }

  listByActorUserId(actorUserId: string): AuditLogRecord[] {
    return this.entries.filter((entry) => entry.actorUserId === actorUserId).map((entry) => ({ ...entry }));
  }

  anonymizeActorUser(actorUserId: string, replacementActorUserId = 'deleted-user'): number {
    let updatedCount = 0;

    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      if (!entry || entry.actorUserId !== actorUserId) {
        continue;
      }

      this.entries[index] = {
        ...entry,
        actorUserId: replacementActorUserId,
      };
      updatedCount += 1;
    }

    return updatedCount;
  }
}
