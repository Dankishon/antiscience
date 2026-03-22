import { Injectable } from '@nestjs/common';
import type { ApiHealthResponse } from '@flower-survey/shared';
import { APP_NAME } from '@flower-survey/shared';

@Injectable()
export class HealthService {
  getStatus(): ApiHealthResponse {
    return {
      service: `${APP_NAME}-backend`,
      status: process.env.DATABASE_URL ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        configured: Boolean(process.env.DATABASE_URL),
        provider: 'postgresql',
      },
      auth: {
        jwtConfigured: Boolean(process.env.JWT_SECRET),
        oauthConfigured:
          Boolean(process.env.OAUTH_CLIENT_ID) && Boolean(process.env.OAUTH_CLIENT_SECRET),
      },
    };
  }
}
