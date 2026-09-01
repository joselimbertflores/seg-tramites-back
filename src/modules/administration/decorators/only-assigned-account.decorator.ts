import { UseGuards, applyDecorators } from '@nestjs/common';
import { AccountGuard } from '../guards/account.guard';

export function OnlyAssignedAccount() {
  return applyDecorators(UseGuards(AccountGuard));
}
