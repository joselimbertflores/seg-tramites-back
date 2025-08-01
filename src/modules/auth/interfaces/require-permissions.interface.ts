import { SystemResource } from "../constants";

export interface RequirePermissionsMetadata {
  resource: SystemResource;
  actions: string[];
  match?: 'every' | 'some';
}
