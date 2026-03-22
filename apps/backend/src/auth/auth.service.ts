import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiErrorException } from '../common/api-error.exception';
import { AuthConfigService } from './auth.config';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthStoreService } from './auth-store.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import type { AuthRequestContext, AuthSessionDto, AuthUserDto, AuthUserRecord } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthConfigService)
    private readonly authConfig: AuthConfigService,
    @Inject(AuthRateLimitService)
    private readonly authRateLimit: AuthRateLimitService,
    @Inject(AuthStoreService)
    private readonly authStore: AuthStoreService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
  ) {}

  async register(input: RegisterDto, context: AuthRequestContext): Promise<AuthSessionDto> {
    const email = normalizeEmail(input.email);
    this.authRateLimit.consume(
      'register',
      buildRateLimitKey(context.ipAddress, email),
      this.authConfig.registerRateLimit,
    );

    if (this.authStore.findUserByEmail(email)) {
      throw new ApiErrorException(
        HttpStatus.CONFLICT,
        'email_in_use',
        'A user with this email already exists.',
      );
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const user = this.authStore.createUser({
      email,
      passwordHash,
      displayName: input.displayName?.trim() || null,
    });

    const loggedInUser = this.markUserLoggedIn(user.id) ?? user;
    return this.issueSession(loggedInUser, context);
  }

  async login(input: LoginDto, context: AuthRequestContext): Promise<AuthSessionDto> {
    const email = normalizeEmail(input.email);
    this.authRateLimit.consume(
      'login',
      buildRateLimitKey(context.ipAddress, email),
      this.authConfig.loginRateLimit,
    );

    const user = this.authStore.findUserByEmail(email);
    if (!user) {
      throw new ApiErrorException(
        HttpStatus.UNAUTHORIZED,
        'invalid_credentials',
        'Invalid email or password.',
      );
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw new ApiErrorException(
        HttpStatus.UNAUTHORIZED,
        'invalid_credentials',
        'Invalid email or password.',
      );
    }

    const loggedInUser = this.markUserLoggedIn(user.id);
    if (!loggedInUser) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'User account is not available.');
    }

    return this.issueSession(loggedInUser, context);
  }

  async refresh(refreshToken: string | undefined, context: AuthRequestContext): Promise<AuthSessionDto> {
    if (!refreshToken) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'invalid_refresh_token', 'Refresh token is missing.');
    }

    const refreshRecord = this.authStore.findRefreshTokenByHash(this.tokenService.hashRefreshToken(refreshToken));
    if (!refreshRecord || refreshRecord.revokedAt || new Date(refreshRecord.expiresAt).getTime() <= Date.now()) {
      throw new ApiErrorException(
        HttpStatus.UNAUTHORIZED,
        'invalid_refresh_token',
        'Refresh token is invalid or expired.',
      );
    }

    const user = this.authStore.findUserById(refreshRecord.userId);
    if (!user) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'User account is not available.');
    }

    return this.issueSession(user, context, {
      familyId: refreshRecord.familyId,
      rotateTokenId: refreshRecord.id,
    });
  }

  logout(refreshToken: string | undefined): void {
    if (!refreshToken) {
      return;
    }

    const refreshRecord = this.authStore.findRefreshTokenByHash(this.tokenService.hashRefreshToken(refreshToken));
    if (!refreshRecord || refreshRecord.revokedAt) {
      return;
    }

    this.authStore.revokeRefreshToken(refreshRecord.id, new Date().toISOString());
  }

  me(accessToken: string | undefined): AuthUserDto {
    return this.requireAuthenticatedUser(accessToken);
  }

  requireAuthenticatedUser(accessToken: string | undefined): AuthUserDto {
    if (!accessToken) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Access token is missing.');
    }

    let payload;
    try {
      payload = this.tokenService.verifyAccessToken(accessToken);
    } catch {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Access token is invalid or expired.');
    }

    if (payload.typ !== 'access') {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Access token is invalid.');
    }

    const user = this.authStore.findUserById(payload.sub);
    if (!user) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'User account is not available.');
    }

    return this.toPublicUser(user);
  }

  private issueSession(
    user: AuthUserRecord,
    context: AuthRequestContext,
    options?: {
      familyId?: string;
      rotateTokenId?: string;
    },
  ): AuthSessionDto {
    const accessToken = this.tokenService.issueAccessToken(user);
    const refreshToken = this.tokenService.issueRefreshToken();
    const refreshRecord = this.authStore.createRefreshToken({
      userId: user.id,
      familyId: options?.familyId ?? randomUUID(),
      tokenHash: refreshToken.tokenHash,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: refreshToken.expiresAt,
    });

    if (options?.rotateTokenId) {
      this.authStore.rotateRefreshToken(options.rotateTokenId, refreshRecord.id, new Date().toISOString());
    }

    return {
      user: this.toPublicUser(user),
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshTokenExpiresAt: refreshToken.expiresAt,
    };
  }

  private markUserLoggedIn(userId: string): AuthUserRecord | null {
    return this.authStore.touchUserLogin(userId, new Date().toISOString());
  }

  private toPublicUser(user: AuthUserRecord): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildRateLimitKey(ipAddress: string, email: string): string {
  return `${ipAddress}:${email}`;
}
