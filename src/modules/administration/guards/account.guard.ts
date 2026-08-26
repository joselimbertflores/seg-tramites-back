import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reflector } from '@nestjs/core';

import { User } from 'src/modules/users/schemas';
import { Account } from '../schemas';
import { RoleContext } from 'src/modules/users/schemas';
import { ACCOUNT_PERMISSIONS_META, AccountPermissionsMetadata } from './account-permissions.metadata';

const methodToActionMap: Record<string, string> = {
  PATCH: 'update',
  POST: 'create',
  GET: 'read',
  PUT: 'update',
  DELETE: 'delete',
};

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(@InjectModel(Account.name) private accountModel: Model<Account>, private reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user: User = request['user'];
    if (!user) {
      throw new InternalServerErrorException('User is not authenticated');
    }
    const account = await this.accountModel
      .findOne({ user: user._id })
      .populate(['officer', 'dependencia', 'institution', 'role']);

    if (!account) {
      throw new ForbiddenException(`Missing account`);
    }
    if (!account.user || !account.officer) {
      throw new BadRequestException(`Account is not assigned`);
    }

    const metadata = this.reflector.getAllAndOverride<AccountPermissionsMetadata>(ACCOUNT_PERMISSIONS_META, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (metadata) {
      if (!account.role || account.role.context !== RoleContext.ACCOUNT) {
        throw new ForbiddenException(`Account has no valid operational role`);
      }
      const action = metadata.action ?? methodToActionMap[request.method];
      const authorized = metadata.resources.some((resource) => {
        const permission = account.role.permissions.find((item) => item.resource === resource);
        return permission && action && permission.actions.includes(action);
      });
      if (!authorized) throw new ForbiddenException(`Account role does not have the required permission`);
    }
    request['account'] = account;
    return true;
  }
}
