import { HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiErrorException } from '../common/api-error.exception';
import type { AuthenticatedRequest } from './auth-request.types';
import { ADMIN_PERMISSIONS_KEY, type AdminPermission } from './permissions.decorator';
import type { AuthRoleCode } from './auth.types';

const ROLE_PERMISSIONS: Record<AuthRoleCode, AdminPermission[]> = {
  OWNER: ['survey.publish', 'asset.manage', 'analytics.read', 'analytics.export', 'retention.manage'],
  ADMIN: ['survey.publish', 'asset.manage', 'analytics.read', 'analytics.export', 'retention.manage'],
  EDITOR: [],
  ANALYST: ['analytics.read', 'analytics.export'],
  RESPONDENT: [],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<AdminPermission[]>(ADMIN_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;
    if (!user) {
      throw new ApiErrorException(HttpStatus.UNAUTHORIZED, 'unauthorized', 'Authentication is required.');
    }

    const grantedPermissions = new Set(
      user.roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []),
    );

    const hasRequiredPermission = requiredPermissions.every((permission) => grantedPermissions.has(permission));
    if (!hasRequiredPermission) {
      throw new ApiErrorException(
        HttpStatus.FORBIDDEN,
        'forbidden',
        'You do not have permission to perform this action.',
        {
          requiredPermissions,
          roles: user.roles,
        },
      );
    }

    return true;
  }
}
