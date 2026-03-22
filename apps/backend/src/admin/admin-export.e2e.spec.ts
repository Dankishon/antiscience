import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
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

describe('Admin analytics export', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('exports paginated JSON and streamed CSV with filtering and escaping', async () => {
    app = await createApp();
    const authStore = app.get(AuthStoreService);
    const responsesStore = app.get(ResponsesStoreService);
    const analystAgent = request.agent(app.getHttpServer());

    const analystRegister = await analystAgent.post('/api/auth/register').send({
      email: 'analyst@example.com',
      password: 'StrongPass123!',
      displayName: 'Analyst',
    });
    expect(analystRegister.status).toBe(201);
    authStore.assignRole(analystRegister.body.user.id as string, 'ANALYST');

    const responseOne = await request(app.getHttpServer())
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });
    const responseTwo = await request(app.getHttpServer())
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });

    await request(app.getHttpServer())
      .put(`/api/v1/responses/${responseOne.body.id}/answers`)
      .send({ answers: buildAllAnswers() })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/responses/${responseTwo.body.id}/answers`)
      .send({ answers: buildAllAnswers() })
      .expect(200);

    await request(app.getHttpServer()).post(`/api/v1/responses/${responseOne.body.id}/submit`).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/responses/${responseTwo.body.id}/submit`).expect(201);

    const firstSession = responsesStore.getById(responseOne.body.id as string);
    const secondSession = responsesStore.getById(responseTwo.body.id as string);
    if (!firstSession || !secondSession || !firstSession.result || !secondSession.result) {
      throw new Error('Submitted sessions were not persisted for export test.');
    }

    firstSession.submittedAt = '2026-03-21T10:00:00.000Z';
    firstSession.updatedAt = firstSession.submittedAt;
    firstSession.result.mainFlower.flowerTitle = 'Лилия, "тест"';
    responsesStore.save(firstSession);

    secondSession.submittedAt = '2026-03-22T10:00:00.000Z';
    secondSession.updatedAt = secondSession.submittedAt;
    responsesStore.save(secondSession);

    const jsonExportResponse = await analystAgent.get(
      '/api/admin/analytics/export?format=json&from=2026-03-22T00:00:00.000Z&to=2026-03-22T23:59:59.999Z&limit=1&page=1',
    );

    expect(jsonExportResponse.status).toBe(200);
    expect(jsonExportResponse.headers['content-type']).toContain('application/json');
    expect(jsonExportResponse.headers['x-export-limit']).toBe('1');
    expect(jsonExportResponse.headers['x-export-total-matched']).toBe('1');
    expect(Array.isArray(jsonExportResponse.body)).toBe(true);
    expect(jsonExportResponse.body).toHaveLength(1);
    expect(jsonExportResponse.body[0].responseSession.id).toBe(responseTwo.body.id);
    expect(jsonExportResponse.body[0].scaleScores).toHaveLength(10);

    const csvExportResponse = await analystAgent.get(
      '/api/admin/analytics/export?format=csv&limit=1&page=1',
    );

    expect(csvExportResponse.status).toBe(200);
    expect(csvExportResponse.headers['content-type']).toContain('text/csv');
    expect(csvExportResponse.headers['content-disposition']).toContain('attachment; filename=');
    expect(csvExportResponse.text).toContain('response_id,survey_id,survey_code');
    expect(csvExportResponse.text).toContain('"Лилия, ""тест"""');

    const limitValidationResponse = await analystAgent.get(
      '/api/admin/analytics/export?format=json&limit=501',
    );

    expect(limitValidationResponse.status).toBe(400);
    expect(limitValidationResponse.body.error.code).toBe('validation_error');
  });
});
