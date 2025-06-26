import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SystemResource } from 'src/modules/auth/constants';
import { User } from 'src/modules/users/schemas';

import { META_PERMISSIONS } from '../decorators';

export interface RequirePermissionsMetadata {
  resource: SystemResource;
  actions: string[];
  match?: 'every' | 'some';
}

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

    const resourcePermissions = user.role.permissions.find((role) => role.resource === resource);
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
