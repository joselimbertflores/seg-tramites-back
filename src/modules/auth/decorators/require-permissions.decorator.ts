import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../guards';
import { RequirePermissionsMetadata } from '../interfaces';

export const META_PERMISSIONS = 'permissions';
export function RequirePermission(
  resources: RequirePermissionsMetadata['resources'][number] | RequirePermissionsMetadata['resources'],
  actions?: string | string[],
  match: RequirePermissionsMetadata['match'] = 'every',
) {
  const metadata: RequirePermissionsMetadata = {
    resources: Array.isArray(resources) ? resources : [resources],
    actions: actions ? (Array.isArray(actions) ? actions : [actions]) : [],
    match,
  };
  return applyDecorators(SetMetadata(META_PERMISSIONS, metadata), UseGuards(PermissionGuard));
}
