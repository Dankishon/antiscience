import { Module } from '@nestjs/common';
import { AccessAuthGuard } from './access-auth.guard';
import { AuthConfigService } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { AuthStoreService } from './auth-store.service';
import { PermissionsGuard } from './permissions.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [
    AccessAuthGuard,
    AuthConfigService,
    AuthRateLimitService,
    AuthService,
    AuthStoreService,
    PermissionsGuard,
    PasswordService,
    TokenService,
  ],
  exports: [AccessAuthGuard, AuthConfigService, AuthService, AuthStoreService, PermissionsGuard],
})
export class AuthModule {}
