import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

import { AuthorizationContextService } from 'src/modules/auth/services';

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(private readonly authorizationContext: AuthorizationContextService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const { account } = await this.authorizationContext.resolveRequest(request);

    if (!account) {
      throw new ForbiddenException('Esta operación requiere una cuenta y un funcionario asignados');
    }

    request['account'] = account;
    return true;
  }
}
