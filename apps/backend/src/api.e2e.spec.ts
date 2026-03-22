import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

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

describe('Flower Survey API', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('serves the active survey, questions, response workflow and result', async () => {
    app = await createApp();

    const activeSurveyResponse = await request(app.getHttpServer()).get(
      '/api/v1/surveys/flower-soul-profile/active',
    );

    expect(activeSurveyResponse.status).toBe(200);
    expect(activeSurveyResponse.body.id).toBe('flower-soul-profile@1');
    expect(activeSurveyResponse.body.questionCount).toBe(30);

    const questionsResponse = await request(app.getHttpServer()).get(
      '/api/v1/surveys/flower-soul-profile@1/questions',
    );

    expect(questionsResponse.status).toBe(200);
    expect(questionsResponse.body.questions).toHaveLength(30);
    expect(questionsResponse.body.likertScale).toHaveLength(5);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe('in_progress');
    expect(createResponse.body.answeredCount).toBe(0);

    const responseId = createResponse.body.id as string;

    const saveAnswersResponse = await request(app.getHttpServer())
      .put(`/api/v1/responses/${responseId}/answers`)
      .send({ answers: buildAllAnswers() });

    expect(saveAnswersResponse.status).toBe(200);
    expect(saveAnswersResponse.body.answeredCount).toBe(30);

    const submitResponse = await request(app.getHttpServer()).post(
      `/api/v1/responses/${responseId}/submit`,
    );

    expect(submitResponse.status).toBe(201);
    expect(submitResponse.body.status).toBe('submitted');
    expect(submitResponse.body.mainFlower.flowerCode).toBe('lily');

    const resultResponse = await request(app.getHttpServer()).get(
      `/api/v1/responses/${responseId}/result`,
    );

    expect(resultResponse.status).toBe(200);
    expect(resultResponse.body.result.mainFlower.flowerCode).toBe('lily');
    expect(resultResponse.body.result.tieBreak.strategy).toBe('none');
  });

  it('returns unified errors with request_id for incomplete submissions', async () => {
    app = await createApp();

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/responses')
      .send({ surveyId: 'flower-soul-profile@1' });
    const responseId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .put(`/api/v1/responses/${responseId}/answers`)
      .send({
        answers: [{ questionCode: 'hs_01', value: 4 }],
      })
      .expect(200);

    const submitResponse = await request(app.getHttpServer()).post(
      `/api/v1/responses/${responseId}/submit`,
    );

    expect(submitResponse.status).toBe(400);
    expect(submitResponse.body.error.code).toBe('response_incomplete');
    expect(submitResponse.body.error.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(submitResponse.body.error.details.missingQuestionCodes).toHaveLength(29);
  });

  it('restricts owned sessions to the owner header', async () => {
    app = await createApp();

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/responses')
      .set('x-user-id', 'user-1')
      .send({ surveyId: 'flower-soul-profile@1' });
    const responseId = createResponse.body.id as string;

    const forbiddenResponse = await request(app.getHttpServer())
      .put(`/api/v1/responses/${responseId}/answers`)
      .set('x-user-id', 'user-2')
      .send({
        answers: [{ questionCode: 'hs_01', value: 4 }],
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error.code).toBe('forbidden');
    expect(forbiddenResponse.body.error.message).toContain('owner');
  });
});
