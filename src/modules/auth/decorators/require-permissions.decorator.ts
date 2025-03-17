import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { SystemResource } from '../constants';
import { PermissionGuard } from '../guards';

export const META_PERMISSIONS = 'permissions';
export function RequirePermissions(resource: SystemResource, actions: string[]) {
    return applyDecorators(SetMetadata(META_PERMISSIONS, { resource, actions }), UseGuards(PermissionGuard));
}
