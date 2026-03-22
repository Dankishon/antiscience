import { Injectable } from '@nestjs/common';
import type { StoredResponseSession } from './responses.types';

@Injectable()
export class ResponsesStoreService {
  private readonly sessions = new Map<string, StoredResponseSession>();

  create(session: StoredResponseSession): StoredResponseSession {
    this.sessions.set(session.id, session);
    return session;
  }

  getById(id: string): StoredResponseSession | null {
    return this.sessions.get(id) ?? null;
  }

  delete(id: string): StoredResponseSession | null {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    this.sessions.delete(id);
    return session;
  }

  save(session: StoredResponseSession): StoredResponseSession {
    this.sessions.set(session.id, session);
    return session;
  }

  listAll(): StoredResponseSession[] {
    return Array.from(this.sessions.values());
  }

  listByUserId(userId: string): StoredResponseSession[] {
    return this.listAll().filter((session) => session.userId === userId);
  }

  deleteByUserId(userId: string): StoredResponseSession[] {
    const deletedSessions = this.listByUserId(userId);
    for (const session of deletedSessions) {
      this.sessions.delete(session.id);
    }

    return deletedSessions;
  }

  deleteAnonymousOlderThan(cutoffIso: string): StoredResponseSession[] {
    const cutoff = new Date(cutoffIso).getTime();
    const deletedSessions = this.listAll().filter((session) => {
      if (session.userId) {
        return false;
      }

      return new Date(session.createdAt).getTime() < cutoff;
    });

    for (const session of deletedSessions) {
      this.sessions.delete(session.id);
    }

    return deletedSessions;
  }
}
