import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { META_PERMISSIONS } from '../decorators';
import { RequirePermissionsMetadata } from '../interfaces';
import { AuthorizationContextService } from '../services';

const methodToActionMap: Record<string, string> = {
  PATCH: 'update',
  POST: 'create',
  GET: 'read',
  PUT: 'update',
  DELETE: 'delete',
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private authorizationContext: AuthorizationContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const data = this.reflector.getAllAndOverride<RequirePermissionsMetadata>(META_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!data) return true;

    const request = context.switchToHttp().getRequest();
    const actions = data.actions.length ? data.actions : [methodToActionMap[request.method]];
    const requirement = { ...data, actions: actions.filter(Boolean) };
    const authorization = await this.authorizationContext.resolveRequest(request);

    if (!requirement.actions.length || !this.authorizationContext.hasPermission(authorization, requirement)) {
      throw new ForbiddenException('No tiene los permisos necesarios para realizar esta acción');
    }
    return true;
  }
}
