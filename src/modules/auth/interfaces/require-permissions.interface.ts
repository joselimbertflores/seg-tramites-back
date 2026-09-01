import { SystemResource } from "../constants";

export interface RequirePermissionsMetadata {
  resources: SystemResource[];
  actions: string[];
  match?: 'every' | 'some';
}
