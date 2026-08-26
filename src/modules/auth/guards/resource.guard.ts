import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RoleContext, User } from 'src/modules/users/schemas';
import { META_RESOURCE } from '../decorators';
import { SystemResource } from '../constants';

const methodToActionMap = {
  PATCH: 'update',
  POST: 'create',
  GET: 'read',
  PUT: 'update',
  DELETE: 'delete',
};

@Injectable()
export class ResourceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const validResource = this.reflector.getAllAndOverride<SystemResource>(META_RESOURCE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!validResource) return true;

    const req = context.switchToHttp().getRequest();
    const user: User = req['user'];

    if (!user) throw new InternalServerErrorException('ResourceGuard error, no user in request');

    if (!user.directRole || user.directRole.context !== RoleContext.USER) {
      throw new ForbiddenException(`Esta identidad no tiene un rol administrativo.`);
    }

    const permissions = user.directRole.permissions.find((permission) => permission.resource === validResource);

    if (!permissions) throw new ForbiddenException(`Esta cuenta no tiene los permisos necesarios.`);

    if (!permissions.actions.includes(methodToActionMap[req.method])) {
      throw new ForbiddenException({
        statusCode: 403,
        message: `No puede realizar esta accion`,
        error: 'Forbidden',
      });
    }
    return true;
  }
}
