import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { PaginationDto } from 'src/modules/common';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  jobtitle: string;

  @IsMongoId()
  dependencyId: string;

  @IsMongoId()
  roleId: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  employmentType?: string | null;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  assigneeExternalKey?: string | null;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class AssignAccountDto {
  @IsString()
  @IsNotEmpty()
  assigneeExternalKey: string;
}

export class FilterAccountDto extends PaginationDto {
  @IsMongoId()
  @IsOptional()
  institution?: string;

  @IsMongoId()
  @IsOptional()
  dependency?: string;
}
