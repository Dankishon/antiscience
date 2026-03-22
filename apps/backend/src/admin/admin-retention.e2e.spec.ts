import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { AuthStoreService } from '../auth/auth-store.service';
import { ResponsesStoreService } from '../responses/responses.store';
import { AuditLogService } from './audit-log.service';

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Admin retention API', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('updates anonymous-session retention and deletes only old anonymous sessions', async () => {
    app = await createApp();
    const server = app.getHttpServer();
    const adminAgent = request.agent(server);
    const authStore = app.get(AuthStoreService);
    const responsesStore = app.get(ResponsesStoreService);
    const auditLog = app.get(AuditLogService);

    const registerResponse = await adminAgent.post('/api/auth/register').send({
      email: 'retention-admin@example.com',
      password: 'StrongPass123!',
      displayName: 'Retention Admin',
    });
    expect(registerResponse.status).toBe(201);
    const adminUserId = registerResponse.body.user.id as string;
    authStore.assignRole(adminUserId, 'ADMIN');

    const initialRetention = await adminAgent.get('/api/admin/retention/anonymous-sessions');
    expect(initialRetention.status).toBe(200);
    expect(initialRetention.body.retentionDays).toBe(30);

    const oldAnonymousResponse = await request(server)
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(oldAnonymousResponse.status).toBe(201);

    const freshAnonymousResponse = await request(server)
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(freshAnonymousResponse.status).toBe(201);

    const identifiedResponse = await request(server)
      .post('/api/v1/responses')
      .set('x-user-id', adminUserId)
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(identifiedResponse.status).toBe(201);

    const oldAnonymousSession = responsesStore.getById(oldAnonymousResponse.body.id as string);
    const oldIdentifiedSession = responsesStore.getById(identifiedResponse.body.id as string);
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

    if (!oldAnonymousSession || !oldIdentifiedSession) {
      throw new Error('Expected seeded response sessions to exist.');
    }

    oldAnonymousSession.createdAt = fortyDaysAgo;
    oldAnonymousSession.updatedAt = fortyDaysAgo;
    responsesStore.save(oldAnonymousSession);

    oldIdentifiedSession.createdAt = fortyDaysAgo;
    oldIdentifiedSession.updatedAt = fortyDaysAgo;
    responsesStore.save(oldIdentifiedSession);

    const updateRetention = await adminAgent.put('/api/admin/retention/anonymous-sessions').send({
      retentionDays: 7,
      runCleanup: true,
    });

    expect(updateRetention.status).toBe(200);
    expect(updateRetention.body.retentionDays).toBe(7);
    expect(updateRetention.body.cleanup.executed).toBe(true);
    expect(updateRetention.body.cleanup.deletedSessionsCount).toBe(1);

    const retentionAfterUpdate = await adminAgent.get('/api/admin/retention/anonymous-sessions');
    expect(retentionAfterUpdate.status).toBe(200);
    expect(retentionAfterUpdate.body.retentionDays).toBe(7);
    expect(retentionAfterUpdate.body.lastDeletedCount).toBe(1);
    expect(retentionAfterUpdate.body.lastCleanupAt).toBeTruthy();

    expect(responsesStore.getById(oldAnonymousResponse.body.id as string)).toBeNull();
    expect(responsesStore.getById(freshAnonymousResponse.body.id as string)).not.toBeNull();
    expect(responsesStore.getById(identifiedResponse.body.id as string)).not.toBeNull();

    const actions = auditLog.list().map((entry) => entry.action);
    expect(actions).toContain('retention.anonymous_sessions.update');
    expect(actions).toContain('retention.anonymous_sessions.cleanup');
  });
});
