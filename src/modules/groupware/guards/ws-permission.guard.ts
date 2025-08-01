import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Reflector } from '@nestjs/core';

import { User } from 'src/modules/users/schemas';
import { RequirePermissionsMetadata } from 'src/modules/auth/interfaces';
import { WS_META_PERMISSIONS } from '../decorators/ws-require-permissions.decorator';

@Injectable()
export class WsPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();

    const user: User = client.data.user;

    if (!user) throw new WsException('No user provide');

    const metadata: RequirePermissionsMetadata = this.reflector.get(WS_META_PERMISSIONS, context.getHandler());

    if (!metadata) return true;

    const { resource, actions, match = 'every' } = metadata;

    const permissions = user.role.permissions.find((per) => per.resource === resource);

    if (!permissions) {
      throw new WsException(`Access denied: Missing permissions for ${resource}`);
    }

    const hasRequiredActions = actions[match]((action) => permissions.actions.includes(action));

    if (!hasRequiredActions) {
      const mode = match === 'some' ? 'one of' : 'all of';
      throw new WsException(`Access denied: Missing required actions (${mode}): ${actions.join(', ')}`);
    }
    return true;
  }
}
