import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { parseCookieHeader } from './auth-cookie.util';
import { AuthConfigService } from './auth.config';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth-request.types';

@Injectable()
export class AccessAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = parseCookieHeader(request.headers.cookie);
    const user = this.authService.requireAuthenticatedUser(cookies[this.authConfig.accessTokenCookieName]);

    request.authUser = user;
    return true;
  }
}
