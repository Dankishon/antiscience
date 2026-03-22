import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { clearCookie, parseCookieHeader, serializeCookie } from './auth-cookie.util';
import { AuthConfigService } from './auth.config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthSessionDto } from './auth.types';

const AUTH_DTO_TYPES = [RegisterDto, LoginDto];
void AUTH_DTO_TYPES;

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Post('register')
  async register(
    @Body() input: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(input, this.buildRequestContext(request));
    this.setAuthCookies(response, session);

    return {
      user: session.user,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(input, this.buildRequestContext(request));
    this.setAuthCookies(response, session);

    return {
      user: session.user,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Headers('cookie') cookieHeader: string | undefined, @Res({ passthrough: true }) response: Response) {
    const cookies = parseCookieHeader(cookieHeader);
    this.authService.logout(cookies[this.authConfig.refreshTokenCookieName]);
    this.clearAuthCookies(response);

    return {
      success: true,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Headers('cookie') cookieHeader: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = parseCookieHeader(cookieHeader);
    const session = await this.authService.refresh(
      cookies[this.authConfig.refreshTokenCookieName],
      this.buildRequestContext(request),
    );
    this.setAuthCookies(response, session);

    return {
      user: session.user,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    };
  }

  @Get('me')
  me(@Headers('cookie') cookieHeader: string | undefined) {
    const cookies = parseCookieHeader(cookieHeader);

    return {
      user: this.authService.me(cookies[this.authConfig.accessTokenCookieName]),
    };
  }

  private buildRequestContext(request: Request) {
    return {
      ipAddress: request.ip || request.socket.remoteAddress || 'unknown',
      userAgent: request.headers['user-agent'] ?? null,
    };
  }

  private setAuthCookies(response: Response, session: AuthSessionDto): void {
    response.setHeader('Set-Cookie', [
      serializeCookie(this.authConfig.accessTokenCookieName, session.accessToken, {
        httpOnly: true,
        secure: this.authConfig.cookieSecure,
        sameSite: this.authConfig.cookieSameSite,
        path: this.authConfig.cookiePath,
        maxAge: this.authConfig.accessTokenTtlSeconds,
        expires: new Date(session.accessTokenExpiresAt),
      }),
      serializeCookie(this.authConfig.refreshTokenCookieName, session.refreshToken, {
        httpOnly: true,
        secure: this.authConfig.cookieSecure,
        sameSite: this.authConfig.cookieSameSite,
        path: this.authConfig.cookiePath,
        maxAge: this.authConfig.refreshTokenTtlSeconds,
        expires: new Date(session.refreshTokenExpiresAt),
      }),
    ]);
  }

  private clearAuthCookies(response: Response): void {
    response.setHeader('Set-Cookie', [
      clearCookie(this.authConfig.accessTokenCookieName, {
        httpOnly: true,
        secure: this.authConfig.cookieSecure,
        sameSite: this.authConfig.cookieSameSite,
        path: this.authConfig.cookiePath,
      }),
      clearCookie(this.authConfig.refreshTokenCookieName, {
        httpOnly: true,
        secure: this.authConfig.cookieSecure,
        sameSite: this.authConfig.cookieSameSite,
        path: this.authConfig.cookiePath,
      }),
    ]);
  }
}
