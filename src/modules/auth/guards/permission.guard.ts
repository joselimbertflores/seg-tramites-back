import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RoleContext, User } from 'src/modules/users/schemas';
import { META_PERMISSIONS } from '../decorators';
import { RequirePermissionsMetadata } from '../interfaces';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const data: RequirePermissionsMetadata | undefined = this.reflector.get(META_PERMISSIONS, context.getHandler());
    if (!data) return true;
    const { resource, actions, match = 'every' } = data;

    const req = context.switchToHttp().getRequest();
    const user: User = req['user'];

    if (!user) throw new InternalServerErrorException('ReportGuard error, no user in request');

    if (!user.directRole || user.directRole.context !== RoleContext.USER) {
      throw new ForbiddenException(`Access denied: Missing direct role`);
    }
    const resourcePermissions = user.directRole.permissions.find((role) => role.resource === resource);
    if (!resourcePermissions) {
      throw new ForbiddenException(`Access denied: Missing permissions for ${resource}`);
    }

    const hasRequiredActions = actions[match]((action) => resourcePermissions.actions.includes(action));

    if (!hasRequiredActions) {
      const mode = data.match === 'some' ? 'one of' : 'all of';
      throw new ForbiddenException(`Access denied: Missing required actions (${mode}): ${data.actions.join(', ')}`);
    }
    return true;
  }
}
