import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { SystemResource } from 'src/modules/auth/constants';
import { RoleContext } from '../schemas';

export class PermissionsDto {
  @IsEnum(SystemResource)
  resource: SystemResource;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  actions: string[];
}
export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEnum(RoleContext)
  context: RoleContext;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => PermissionsDto)
  permissions: PermissionsDto[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
