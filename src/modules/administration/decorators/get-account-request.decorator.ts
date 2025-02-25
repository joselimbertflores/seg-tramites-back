import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';

// extract user nested by strategy method in request
export const GetAccountRequest = createParamDecorator(
  (propertyPath: string, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const account = req['account'];
    if (!account) {
      throw new InternalServerErrorException('Account not found in request');
    }
    return !propertyPath ? account : account[propertyPath];
  },
);
