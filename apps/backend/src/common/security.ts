import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

function parseOriginList(value: string | undefined): string[] {
  const fromEnv = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return fromEnv.length > 0 ? fromEnv : DEFAULT_CORS_ORIGINS;
}

function buildApiContentSecurityPolicy() {
  return ["default-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"].join(
    '; ',
  );
}

export function applyBackendSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Content-Security-Policy', buildApiContentSecurityPolicy());
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

export function configureCors(app: INestApplication): void {
  const allowedOrigins = new Set(parseOriginList(process.env.CORS_ORIGINS));

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-User-Id'],
    exposedHeaders: ['x-request-id'],
  });
}
