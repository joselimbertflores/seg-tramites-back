import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RequirePermissionsMetadata } from 'src/modules/auth/interfaces';
import { WsPermissionGuard } from '../guards/ws-permission.guard';

export const WS_META_PERMISSIONS = 'ws_permissions';
export function WsRequirePermissions(properties: RequirePermissionsMetadata) {
  return applyDecorators(SetMetadata(WS_META_PERMISSIONS, properties), UseGuards(WsPermissionGuard));
}
