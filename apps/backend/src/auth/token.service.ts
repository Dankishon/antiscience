import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthConfigService } from './auth.config';
import type { AccessTokenPayload, AuthUserRecord } from './auth.types';

@Injectable()
export class TokenService {
  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {}

  issueAccessToken(user: AuthUserRecord): { token: string; expiresAt: string } {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((nowSeconds + this.authConfig.accessTokenTtlSeconds) * 1000).toISOString();
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        typ: 'access',
      },
      this.authConfig.jwtSecret,
      {
        algorithm: 'HS256',
        issuer: this.authConfig.jwtIssuer,
        expiresIn: this.authConfig.accessTokenTtlSeconds,
      },
    );

    return { token, expiresAt };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, this.authConfig.jwtSecret, {
      algorithms: ['HS256'],
      issuer: this.authConfig.jwtIssuer,
    }) as AccessTokenPayload;
  }

  issueRefreshToken(): { token: string; tokenHash: string; expiresAt: string } {
    const token = randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(token);
    const expiresAt = new Date(Date.now() + this.authConfig.refreshTokenTtlSeconds * 1000).toISOString();

    return {
      token,
      tokenHash,
      expiresAt,
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
