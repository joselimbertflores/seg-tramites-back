import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { SystemResource } from 'src/modules/auth/constants';
import { AccountGuard } from '../guards/account.guard';
import { ACCOUNT_PERMISSIONS_META, AccountPermissionsMetadata } from '../guards/account-permissions.metadata';

export function AccountProtected(resources: SystemResource | SystemResource[], action?: string) {
  const metadata: AccountPermissionsMetadata = {
    resources: Array.isArray(resources) ? resources : [resources],
    action,
  };
  return applyDecorators(SetMetadata(ACCOUNT_PERMISSIONS_META, metadata), UseGuards(AccountGuard));
}
