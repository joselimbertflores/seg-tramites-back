import { SystemResource } from "../constants";

export interface MultiResourceMetadata {
  resources: SystemResource[];
  match?: 'some' | 'every';
}