import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { AuthRoleCode } from './auth.types';

export interface RateLimitPolicy {
  maxAttempts: number;
  windowMs: number;
}

@Injectable()
export class AuthConfigService {
  readonly accessTokenCookieName = 'flower_survey_access_token';
  readonly refreshTokenCookieName = 'flower_survey_refresh_token';
  readonly accessTokenTtlSeconds = Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60);
  readonly refreshTokenTtlSeconds = Number(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60);
  readonly jwtIssuer = 'flower-survey-api';
  readonly cookiePath = '/';
  readonly cookieSameSite = 'Lax' as const;
  readonly cookieSecure =
    (process.env.AUTH_COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) ===
    'true';
  readonly loginRateLimit: RateLimitPolicy = {
    maxAttempts: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 5),
    windowMs: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS ?? 60_000),
  };
  readonly registerRateLimit: RateLimitPolicy = {
    maxAttempts: Number(process.env.AUTH_REGISTER_RATE_LIMIT_MAX_ATTEMPTS ?? 3),
    windowMs: Number(process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS ?? 60_000),
  };
  readonly bootstrapAdminEmails = parseEmailList(process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS);
  readonly bootstrapAnalystEmails = parseEmailList(process.env.AUTH_BOOTSTRAP_ANALYST_EMAILS);

  // OWASP Password Storage Cheat Sheet baseline for Argon2id:
  // memory >= 19 MiB, iterations >= 2, parallelism = 1.
  get argon2Options(): argon2.Options & { raw?: false } {
    return {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    };
  }

  get jwtSecret(): string {
    return process.env.JWT_SECRET?.trim() || 'flower-survey-dev-jwt-secret-change-me';
  }

  getRolesForEmail(email: string): AuthRoleCode[] {
    const normalizedEmail = email.trim().toLowerCase();
    const roles = new Set<AuthRoleCode>(['RESPONDENT']);

    if (this.bootstrapAdminEmails.has(normalizedEmail)) {
      roles.add('ADMIN');
    }

    if (this.bootstrapAnalystEmails.has(normalizedEmail)) {
      roles.add('ANALYST');
    }

    return Array.from(roles);
  }
}

function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}
