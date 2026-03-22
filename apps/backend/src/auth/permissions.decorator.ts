import { SetMetadata } from '@nestjs/common';

export type AdminPermission =
  | 'survey.publish'
  | 'asset.manage'
  | 'analytics.read'
  | 'analytics.export'
  | 'retention.manage';

export const ADMIN_PERMISSIONS_KEY = 'admin_permissions';

export const RequirePermissions = (...permissions: AdminPermission[]) =>
  SetMetadata(ADMIN_PERMISSIONS_KEY, permissions);
