import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MULTI_RESOURCE_META_KEY } from '../decorators';
import { MultiResourceMetadata } from '../interfaces';
import { User } from 'src/modules/users/schemas';

@Injectable()
export class MultiResourceGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.get<MultiResourceMetadata>(MULTI_RESOURCE_META_KEY, context.getClass());
    if (!metadata) return true;

    const { resources, match = 'some' } = metadata;

    const req = context.switchToHttp().getRequest();
    const user: User = req['user'];

    if (!user) throw new InternalServerErrorException('MultiResourceGuard: no user in request');

    const hasPermission = resources[match]((res) => user.role.permissions.some((p) => p.resource === res));

    if (!hasPermission) {
      throw new ForbiddenException(`Access denied: Missing required resources ${resources.join(', ')}`);
    }

    return true;
  }
}
