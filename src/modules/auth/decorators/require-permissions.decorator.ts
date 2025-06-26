import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PermissionGuard, RequirePermissionsMetadata } from '../guards';

export const META_PERMISSIONS = 'permissions';
export function RequirePermissions(properties: RequirePermissionsMetadata) {
  return applyDecorators(SetMetadata(META_PERMISSIONS, properties), UseGuards(PermissionGuard));
}
