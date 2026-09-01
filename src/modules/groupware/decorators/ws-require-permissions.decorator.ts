import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RequirePermissionsMetadata } from 'src/modules/auth/interfaces';
import { SystemResource } from 'src/modules/auth/constants';
import { WsPermissionGuard } from '../guards/ws-permission.guard';

export const WS_META_PERMISSIONS = 'ws_permissions';
export function WsRequirePermission(resources: SystemResource | SystemResource[], actions: string | string[]) {
  const metadata: RequirePermissionsMetadata = {
    resources: Array.isArray(resources) ? resources : [resources],
    actions: Array.isArray(actions) ? actions : [actions],
  };
  return applyDecorators(SetMetadata(WS_META_PERMISSIONS, metadata), UseGuards(WsPermissionGuard));
}
