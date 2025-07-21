import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { MultiResourceMetadata } from "../interfaces";
import { MultiResourceGuard } from "../guards";


export const MULTI_RESOURCE_META_KEY = 'required-resources';
export function MultiResourceProtected(config:MultiResourceMetadata) {
  return applyDecorators(SetMetadata(MULTI_RESOURCE_META_KEY, config), UseGuards(MultiResourceGuard));
}
