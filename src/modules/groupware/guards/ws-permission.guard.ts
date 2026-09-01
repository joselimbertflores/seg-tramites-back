import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Reflector } from '@nestjs/core';

import { User } from 'src/modules/users/schemas';
import { RequirePermissionsMetadata } from 'src/modules/auth/interfaces';
import { WS_META_PERMISSIONS } from '../decorators/ws-require-permissions.decorator';
import { AuthorizationContextService } from 'src/modules/auth/services';

@Injectable()
export class WsPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private authorizationContext: AuthorizationContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();

    const user: User = client.data.user;

    if (!user) throw new WsException('No user provide');

    const metadata: RequirePermissionsMetadata = this.reflector.get(WS_META_PERMISSIONS, context.getHandler());

    if (!metadata) return true;

    const authorization = await this.authorizationContext.resolveUser(user);
    if (!this.authorizationContext.hasPermission(authorization, metadata)) {
      throw new WsException('Access denied: Missing required permission');
    }
    return true;
  }
}
