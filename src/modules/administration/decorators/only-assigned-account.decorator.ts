import { UseGuards, applyDecorators } from '@nestjs/common';
import { AccountGuard } from '../guards/account.guard';

export function onlyAssignedAccount() {
  return applyDecorators(UseGuards(AccountGuard));
}
