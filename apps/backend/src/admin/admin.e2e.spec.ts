import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { AuthStoreService } from '../auth/auth-store.service';
import { AuditLogService } from './audit-log.service';

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

describe('Admin API', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('enforces RBAC and provides publish, asset attach, summary and export endpoints', async () => {
    app = await createApp();
    const authStore = app.get(AuthStoreService);
    const auditLog = app.get(AuditLogService);

    const adminAgent = request.agent(app.getHttpServer());
    const analystAgent = request.agent(app.getHttpServer());

    const adminRegister = await adminAgent.post('/api/auth/register').send({
      email: 'admin@example.com',
      password: 'StrongPass123!',
      displayName: 'Admin',
    });
    expect(adminRegister.status).toBe(201);
    authStore.assignRole(adminRegister.body.user.id as string, 'ADMIN');

    const analystRegister = await analystAgent.post('/api/auth/register').send({
      email: 'analyst@example.com',
      password: 'StrongPass123!',
      displayName: 'Analyst',
    });
    expect(analystRegister.status).toBe(201);
    authStore.assignRole(analystRegister.body.user.id as string, 'ANALYST');

    const anonymousResponse = await request(app.getHttpServer())
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(anonymousResponse.status).toBe(201);

    await request(app.getHttpServer())
      .put(`/api/v1/responses/${anonymousResponse.body.id}/answers`)
      .send({ answers: buildAllAnswers() })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/responses/${anonymousResponse.body.id}/submit`)
      .expect(201);

    const identifiedResponse = await request(app.getHttpServer())
      .post('/api/v1/responses')
      .set('x-user-id', adminRegister.body.user.id as string)
      .send({ surveyId: 'flower-soul-profile@1' });
    expect(identifiedResponse.status).toBe(201);

    await request(app.getHttpServer())
      .put(`/api/v1/responses/${identifiedResponse.body.id}/answers`)
      .set('x-user-id', adminRegister.body.user.id as string)
      .send({ answers: buildAllAnswers() })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/responses/${identifiedResponse.body.id}/submit`)
      .set('x-user-id', adminRegister.body.user.id as string)
      .expect(201);

    const publishResponse = await adminAgent.post('/api/admin/surveys/flower-soul-profile@1/publish');
    expect(publishResponse.status).toBe(200);
    expect(publishResponse.body.status).toBe('active');

    const attachAssetResponse = await adminAgent
      .post('/api/admin/surveys/flower-soul-profile@1/flowers/lily/assets')
      .send({
        kind: 'image',
        title: 'Lily hero',
        altText: 'White lily',
        storageKey: 'flowers/lily/hero.png',
        publicUrl: 'https://cdn.example.com/flowers/lily/hero.png',
        mimeType: 'image/png',
        visibility: 'public',
        metadata: {
          width: 1200,
          height: 800,
        },
      });

    expect(attachAssetResponse.status).toBe(201);
    expect(attachAssetResponse.body.flowerCode).toBe('lily');
    expect(attachAssetResponse.body.assetsForFlower).toBe(1);

    const analystPublishResponse = await analystAgent.post('/api/admin/surveys/flower-soul-profile@1/publish');
    expect(analystPublishResponse.status).toBe(403);
    expect(analystPublishResponse.body.error.code).toBe('forbidden');

    const summaryResponse = await analystAgent.get(
      '/api/admin/analytics/summary?surveyId=flower-soul-profile@1',
    );
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.totals.submittedResponses).toBe(2);
    expect(summaryResponse.body.totals.anonymousResponses).toBe(1);
    expect(summaryResponse.body.totals.identifiedResponses).toBe(1);

    const exportResponse = await analystAgent.get(
      '/api/admin/analytics/export?surveyId=flower-soul-profile@1&format=csv',
    );
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('text/csv');
    expect(exportResponse.text).toContain(
      'response_id,survey_id,survey_code,survey_version,user_id,created_at,updated_at,submitted_at',
    );

    const actions = auditLog.list().map((entry) => entry.action);
    expect(actions).toContain('survey.publish');
    expect(actions).toContain('flower.asset.attach');
    expect(actions).toContain('analytics.export');
  });
});
