import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { AuthConfigService } from './auth.config';

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

function extractCookie(setCookies: string | string[] | undefined, cookieName: string): string {
  const cookieList = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
  const cookie = cookieList.find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookie) {
    throw new Error(`Cookie ${cookieName} is missing.`);
  }

  return cookie.split(';', 1)[0] ?? cookie;
}

describe('Auth API', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('supports register, me, logout, login, refresh rotation and refresh-token reuse rejection', async () => {
    app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const authConfig = app.get(AuthConfigService);

    const registerResponse = await agent.post('/api/auth/register').send({
      email: 'user@example.com',
      password: 'StrongPass123!',
      displayName: 'User',
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe('user@example.com');
    expect(registerResponse.headers['set-cookie']).toBeTruthy();

    const meAfterRegister = await agent.get('/api/auth/me');
    expect(meAfterRegister.status).toBe(200);
    expect(meAfterRegister.body.user.displayName).toBe('User');

    const logoutResponse = await agent.post('/api/auth/logout');
    expect(logoutResponse.status).toBe(200);

    const meAfterLogout = await agent.get('/api/auth/me');
    expect(meAfterLogout.status).toBe(401);
    expect(meAfterLogout.body.error.code).toBe('unauthorized');

    const loginResponse = await agent.post('/api/auth/login').send({
      email: 'USER@example.com',
      password: 'StrongPass123!',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe('user@example.com');

    const originalRefreshCookie = extractCookie(
      loginResponse.headers['set-cookie'],
      authConfig.refreshTokenCookieName,
    );

    const refreshResponse = await agent.post('/api/auth/refresh');
    expect(refreshResponse.status).toBe(200);

    const rotatedRefreshCookie = extractCookie(
      refreshResponse.headers['set-cookie'],
      authConfig.refreshTokenCookieName,
    );
    expect(rotatedRefreshCookie).not.toBe(originalRefreshCookie);

    const refreshReuseResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalRefreshCookie);

    expect(refreshReuseResponse.status).toBe(401);
    expect(refreshReuseResponse.body.error.code).toBe('invalid_refresh_token');
  });

  it('rate-limits repeated failed login attempts', async () => {
    app = await createApp();
    const server = app.getHttpServer();

    await request(server).post('/api/auth/register').send({
      email: 'ratelimit@example.com',
      password: 'StrongPass123!',
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(server).post('/api/auth/login').send({
        email: 'ratelimit@example.com',
        password: 'WrongPass123!',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('invalid_credentials');
    }

    const limitedResponse = await request(server).post('/api/auth/login').send({
      email: 'ratelimit@example.com',
      password: 'WrongPass123!',
    });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body.error.code).toBe('rate_limit_exceeded');
  });
});
