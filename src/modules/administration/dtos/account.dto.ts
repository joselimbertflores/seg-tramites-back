import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { PaginationDto } from 'src/modules/common';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  jobtitle: string;

  @IsMongoId()
  officer: string;

  @IsMongoId()
  dependency: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class UpdateAccountDto extends PartialType(
  OmitType(CreateAccountDto, ['dependency'] as const),
) {}

export class FilterAccountDto extends PaginationDto {
  @IsMongoId()
  @IsOptional()
  dependency?: string;
}
