import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { Role, User } from 'src/modules/users/schemas';
import { SystemResource } from '../constants';
import { RequirePermissionsMetadata } from '../interfaces';

export type EffectivePermissions = Partial<Record<SystemResource, string[]>>;

export interface AuthorizationContext {
  account: Account | null;
  permissions: EffectivePermissions;
}

interface RequestWithAuthorization {
  user?: User;
  account?: Account;
  authorizationContext?: AuthorizationContext;
}

@Injectable()
export class AuthorizationContextService {
  constructor(@InjectModel(Account.name) private readonly accountModel: Model<Account>) {}

  async resolveRequest(request: RequestWithAuthorization): Promise<AuthorizationContext> {
    if (request.authorizationContext) return request.authorizationContext;
    if (!request.user) throw new InternalServerErrorException('Authenticated user is missing from request');

    const authorizationContext = await this.resolveUser(request.user);
    request.authorizationContext = authorizationContext;
    return authorizationContext;
  }

  async resolveUser(user: User): Promise<AuthorizationContext> {
    const account = await this.accountModel
      .findOne({ user: user._id, officer: { $type: 'objectId' } })
      .populate(['officer', 'dependencia', 'institution', 'role']);
    const roles = [...(user.roles ?? []), ...(account?.role ? [account.role] : [])];

    return {
      account: account ?? null,
      permissions: this.mergePermissions(roles),
    };
  }

  hasPermission(context: AuthorizationContext, requirement: RequirePermissionsMetadata): boolean {
    const { resources, actions, match = 'every' } = requirement;
    return resources.some((resource) => {
      const grantedActions = context.permissions[resource] ?? [];
      return actions[match]((action) => grantedActions.includes(action));
    });
  }

  private mergePermissions(roles: Role[]): EffectivePermissions {
    const permissions = new Map<SystemResource, Set<string>>();
    for (const role of roles) {
      for (const permission of role?.permissions ?? []) {
        const actions = permissions.get(permission.resource) ?? new Set<string>();
        permission.actions.forEach((action) => actions.add(action));
        permissions.set(permission.resource, actions);
      }
    }
    return Object.fromEntries(
      [...permissions.entries()].map(([resource, actions]) => [resource, [...actions]]),
    ) as EffectivePermissions;
  }
}
