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
  employmentType?: string;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class AssignAccountDto {
  @IsMongoId()
  userId: string;

  @IsMongoId()
  officerId: string;
}

export class FilterAccountDto extends PaginationDto {
  @IsMongoId()
  @IsOptional()
  institution?: string;

  @IsMongoId()
  @IsOptional()
  dependency?: string;
}
