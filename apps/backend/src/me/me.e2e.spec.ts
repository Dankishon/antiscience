import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { AuditLogService } from '../admin/audit-log.service';
import { AuthStoreService } from '../auth/auth-store.service';
import { ResponsesStoreService } from '../responses/responses.store';

function buildAllAnswers() {
  return [
    { questionCode: 'hs_01', value: 4 },
    { questionCode: 'hs_02', value: 4 },
    { questionCode: 'hs_03', value: 4 },
    { questionCode: 'd_01', value: 0 },
    { questionCode: 'd_02', value: 0 },
    { questionCode: 'd_03', value: 0 },
    { questionCode: 'hy_01', value: 0 },
    { questionCode: 'hy_02', value: 0 },
    { questionCode: 'hy_03', value: 0 },
    { questionCode: 'pd_01', value: 0 },
    { questionCode: 'pd_02', value: 0 },
    { questionCode: 'pd_03', value: 0 },
    { questionCode: 'mf_f_01', value: 0 },
    { questionCode: 'mf_f_02', value: 0 },
    { questionCode: 'mf_f_03', value: 0 },
    { questionCode: 'mf_m_01', value: 0 },
    { questionCode: 'mf_m_02', value: 0 },
    { questionCode: 'mf_m_03', value: 0 },
    { questionCode: 'pa_01', value: 0 },
    { questionCode: 'pa_02', value: 0 },
    { questionCode: 'pa_03', value: 0 },
    { questionCode: 'pt_01', value: 0 },
    { questionCode: 'pt_02', value: 0 },
    { questionCode: 'pt_03', value: 0 },
    { questionCode: 'sc_01', value: 0 },
    { questionCode: 'sc_02', value: 0 },
    { questionCode: 'sc_03', value: 0 },
    { questionCode: 'ma_01', value: 0 },
    { questionCode: 'ma_02', value: 0 },
    { questionCode: 'ma_03', value: 0 },
  ];
}

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Me API', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('exports the authenticated user data as JSON without secret hashes', async () => {
    app = await createApp();
    const server = app.getHttpServer();
    const agent = request.agent(server);
    const authStore = app.get(AuthStoreService);
    const auditLog = app.get(AuditLogService);

    const registerResponse = await agent.post('/api/auth/register').send({
      email: 'gdpr-export@example.com',
      password: 'StrongPass123!',
      displayName: 'GDPR User',
    });

    expect(registerResponse.status).toBe(201);
    const userId = registerResponse.body.user.id as string;

    const responseSession = await request(server)
      .post('/api/v1/responses')
      .set('x-user-id', userId)
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(responseSession.status).toBe(201);

    await request(server)
      .put(`/api/v1/responses/${responseSession.body.id}/answers`)
      .set('x-user-id', userId)
      .send({ answers: buildAllAnswers() })
      .expect(200);

    await request(server)
      .post(`/api/v1/responses/${responseSession.body.id}/submit`)
      .set('x-user-id', userId)
      .expect(201);

    authStore.assignRole(userId, 'ADMIN');
    auditLog.record({
      actorUserId: userId,
      action: 'account.export.preview',
      entityType: 'user',
      entityId: userId,
      metadata: {
        channel: 'e2e',
      },
    });

    const exportResponse = await agent.get('/api/me/export');

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('application/json');
    expect(exportResponse.headers['content-disposition']).toContain('attachment; filename=');
    expect(exportResponse.body.user.email).toBe('gdpr-export@example.com');
    expect(exportResponse.body.responseSessions).toHaveLength(1);
    expect(exportResponse.body.responseSessions[0].answers).toHaveLength(30);
    expect(exportResponse.body.auth.refreshTokens).toHaveLength(1);
    expect(exportResponse.body.auth.refreshTokens[0].tokenHash).toBeUndefined();
    expect(exportResponse.text).not.toContain('passwordHash');
    expect(exportResponse.text).not.toContain('tokenHash');
    expect(exportResponse.body.auditLog).toHaveLength(1);
  });

  it('deletes account data, clears cookies, preserves a sanitized erasure audit entry and keeps anonymous sessions', async () => {
    app = await createApp();
    const server = app.getHttpServer();
    const agent = request.agent(server);
    const auditLog = app.get(AuditLogService);
    const authStore = app.get(AuthStoreService);
    const responsesStore = app.get(ResponsesStoreService);

    const registerResponse = await agent.post('/api/auth/register').send({
      email: 'gdpr-delete@example.com',
      password: 'StrongPass123!',
      displayName: 'Delete Me',
    });
    expect(registerResponse.status).toBe(201);
    const userId = registerResponse.body.user.id as string;

    auditLog.record({
      actorUserId: userId,
      action: 'account.reviewed',
      entityType: 'user',
      entityId: userId,
      metadata: {
        note: 'will be anonymized',
      },
    });

    const ownedResponse = await request(server)
      .post('/api/v1/responses')
      .set('x-user-id', userId)
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(ownedResponse.status).toBe(201);

    const anonymousResponse = await request(server)
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(anonymousResponse.status).toBe(201);

    const deleteResponse = await agent.post('/api/me/delete').send({
      confirmation: 'DELETE',
      reason: 'privacy_request',
    });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
    expect(deleteResponse.body.deletedResponseSessionsCount).toBe(1);
    expect(deleteResponse.body.deletedRefreshTokensCount).toBe(1);
    expect(deleteResponse.headers['set-cookie']).toBeTruthy();
    expect(authStore.findUserById(userId)).toBeNull();
    expect(responsesStore.getById(ownedResponse.body.id as string)).toBeNull();
    expect(responsesStore.getById(anonymousResponse.body.id as string)).not.toBeNull();

    const meAfterDelete = await agent.get('/api/auth/me');
    expect(meAfterDelete.status).toBe(401);
    expect(meAfterDelete.body.error.code).toBe('unauthorized');

    const matchingAuditEntries = auditLog.list().filter((entry) => entry.actorUserId === userId);
    expect(matchingAuditEntries).toHaveLength(0);

    const erasureLog = auditLog.list().find((entry) => entry.action === 'gdpr.user.delete');
    expect(erasureLog).toBeTruthy();
    expect(erasureLog?.actorUserId).toBe('system');
    expect(erasureLog?.metadata).toMatchObject({
      deletedRefreshTokensCount: 1,
      deletedResponseSessionsCount: 1,
      reason: 'privacy_request',
    });
  });
});
