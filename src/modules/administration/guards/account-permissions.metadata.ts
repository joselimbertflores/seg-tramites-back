import { SystemResource } from 'src/modules/auth/constants';

export const ACCOUNT_PERMISSIONS_META = 'account-permissions';

export interface AccountPermissionsMetadata {
  resources: SystemResource[];
  action?: string;
}
