import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Observability and security', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('sets request headers, strict CORS and exposes request metrics', async () => {
    app = await createApp();
    const server = app.getHttpServer();

    const healthResponse = await request(server)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('x-request-id', 'request-observability-test');

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers['x-request-id']).toBe('request-observability-test');
    expect(healthResponse.headers['content-security-policy']).toContain("default-src 'none'");
    expect(healthResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(healthResponse.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(healthResponse.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(healthResponse.headers['access-control-allow-credentials']).toBe('true');
    expect(healthResponse.headers['strict-transport-security']).toBeUndefined();

    const blockedOriginResponse = await request(server)
      .get('/api/health')
      .set('Origin', 'http://evil.example');

    expect(blockedOriginResponse.status).toBe(200);
    expect(blockedOriginResponse.headers['access-control-allow-origin']).toBeUndefined();

    await request(server)
      .get('/api/v1/surveys/unknown-survey/active')
      .set('Origin', 'http://localhost:3000')
      .expect(404);

    const metricsResponse = await request(server).get('/api/metrics');

    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.body.requests.completions).toBeGreaterThanOrEqual(3);
    expect(metricsResponse.body.requests.errors).toBeGreaterThanOrEqual(1);
    expect(metricsResponse.body.latencyMs.count).toBeGreaterThanOrEqual(3);
    expect(metricsResponse.body.lastRequest.requestId).toBeTruthy();
  });
});
