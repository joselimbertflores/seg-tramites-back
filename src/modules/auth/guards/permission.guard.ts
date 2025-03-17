import { CanActivate, ExecutionContext, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SystemResource } from 'src/modules/auth/constants';
import { User } from 'src/modules/users/schemas';

import { META_PERMISSIONS } from '../decorators';

interface requirePermissions {
  resource: SystemResource
  actions: string[]
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) { }
  canActivate(context: ExecutionContext): boolean {
    const data: requirePermissions | undefined = this.reflector.get(META_PERMISSIONS, context.getHandler());
    if (!data) return true;

    const req = context.switchToHttp().getRequest();
    const user: User = req['user'];

    if (!user) throw new InternalServerErrorException('ReportGuard error, no user in request');

    const resourcePermissions = user.role.permissions.find(({ resource }) => resource === data.resource);
    if (!resourcePermissions) {
      throw new ForbiddenException(`Access denied: Missing permissions for ${data.resource}`);
    }

    const hasRequiredActions = data.actions.every((action) => resourcePermissions.actions.includes(action));

    if (!hasRequiredActions) {
      throw new ForbiddenException(`Access denied: Missing required actions: ${data.actions.join(', ')}`);
    }
    return true
  }
}
