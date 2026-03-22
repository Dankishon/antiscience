export type AuthRoleCode = 'OWNER' | 'ADMIN' | 'EDITOR' | 'ANALYST' | 'RESPONDENT';

export interface AuthRequestContext {
  ipAddress: string;
  userAgent: string | null;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  roles: AuthRoleCode[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthRefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
  lastUsedAt: string | null;
  replacedByTokenId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string | null;
  roles: AuthRoleCode[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthSessionDto {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  typ: 'access';
  iat?: number;
  exp?: number;
  iss?: string;
}
