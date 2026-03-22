import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthConfigService } from './auth.config';
import type { AuthRefreshTokenRecord, AuthRoleCode, AuthUserRecord } from './auth.types';

interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string | null;
}

interface CreateRefreshTokenInput {
  userId: string;
  familyId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
}

@Injectable()
export class AuthStoreService {
  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {}

  private readonly usersById = new Map<string, AuthUserRecord>();
  private readonly userIdsByEmail = new Map<string, string>();
  private readonly refreshTokensById = new Map<string, AuthRefreshTokenRecord>();
  private readonly refreshTokenIdsByHash = new Map<string, string>();

  createUser(input: CreateUserInput): AuthUserRecord {
    const now = new Date().toISOString();
    const user: AuthUserRecord = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      roles: this.authConfig.getRolesForEmail(input.email),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };

    this.usersById.set(user.id, user);
    this.userIdsByEmail.set(user.email, user.id);
    return user;
  }

  findUserByEmail(email: string): AuthUserRecord | null {
    const userId = this.userIdsByEmail.get(email);
    if (!userId) {
      return null;
    }

    return this.usersById.get(userId) ?? null;
  }

  findUserById(id: string): AuthUserRecord | null {
    return this.usersById.get(id) ?? null;
  }

  deleteUser(id: string): AuthUserRecord | null {
    const user = this.usersById.get(id);
    if (!user) {
      return null;
    }

    this.usersById.delete(id);
    this.userIdsByEmail.delete(user.email);
    return user;
  }

  assignRole(userId: string, role: AuthRoleCode): AuthUserRecord | null {
    const user = this.usersById.get(userId);
    if (!user || user.roles.includes(role)) {
      return user ?? null;
    }

    const updated: AuthUserRecord = {
      ...user,
      roles: [...user.roles, role],
      updatedAt: new Date().toISOString(),
    };

    this.usersById.set(userId, updated);
    return updated;
  }

  touchUserLogin(id: string, lastLoginAt: string): AuthUserRecord | null {
    const user = this.usersById.get(id);
    if (!user) {
      return null;
    }

    const updated: AuthUserRecord = {
      ...user,
      lastLoginAt,
      updatedAt: lastLoginAt,
    };

    this.usersById.set(id, updated);
    return updated;
  }

  createRefreshToken(input: CreateRefreshTokenInput): AuthRefreshTokenRecord {
    const now = new Date().toISOString();
    const token: AuthRefreshTokenRecord = {
      id: randomUUID(),
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt: input.expiresAt,
      revokedAt: null,
      rotatedAt: null,
      lastUsedAt: null,
      replacedByTokenId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.refreshTokensById.set(token.id, token);
    this.refreshTokenIdsByHash.set(token.tokenHash, token.id);
    return token;
  }

  findRefreshTokenByHash(tokenHash: string): AuthRefreshTokenRecord | null {
    const tokenId = this.refreshTokenIdsByHash.get(tokenHash);
    if (!tokenId) {
      return null;
    }

    return this.refreshTokensById.get(tokenId) ?? null;
  }

  listRefreshTokensByUserId(userId: string): AuthRefreshTokenRecord[] {
    return Array.from(this.refreshTokensById.values()).filter((token) => token.userId === userId);
  }

  rotateRefreshToken(id: string, replacedByTokenId: string, rotatedAt: string): AuthRefreshTokenRecord | null {
    const token = this.refreshTokensById.get(id);
    if (!token) {
      return null;
    }

    const updated: AuthRefreshTokenRecord = {
      ...token,
      revokedAt: rotatedAt,
      rotatedAt,
      lastUsedAt: rotatedAt,
      replacedByTokenId,
      updatedAt: rotatedAt,
    };

    this.refreshTokensById.set(id, updated);
    return updated;
  }

  revokeRefreshToken(id: string, revokedAt: string): AuthRefreshTokenRecord | null {
    const token = this.refreshTokensById.get(id);
    if (!token) {
      return null;
    }

    const updated: AuthRefreshTokenRecord = {
      ...token,
      revokedAt,
      updatedAt: revokedAt,
    };

    this.refreshTokensById.set(id, updated);
    return updated;
  }

  revokeRefreshTokensByUserId(userId: string, revokedAt: string): AuthRefreshTokenRecord[] {
    return this.listRefreshTokensByUserId(userId)
      .map((token) => this.revokeRefreshToken(token.id, revokedAt))
      .filter((token): token is AuthRefreshTokenRecord => token !== null);
  }

  deleteRefreshTokensByUserId(userId: string): number {
    const tokenIds = this.listRefreshTokensByUserId(userId).map((token) => token.id);
    for (const tokenId of tokenIds) {
      const token = this.refreshTokensById.get(tokenId);
      if (!token) {
        continue;
      }

      this.refreshTokenIdsByHash.delete(token.tokenHash);
      this.refreshTokensById.delete(tokenId);
    }

    return tokenIds.length;
  }
}
