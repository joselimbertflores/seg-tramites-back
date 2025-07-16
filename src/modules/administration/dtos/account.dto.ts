import { IsBoolean, IsDefined, IsMongoId, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { PaginationDto } from 'src/modules/common';
import { Type } from 'class-transformer';
import { CreateUserDto } from 'src/modules/users/dtos';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  jobtitle: string;

  @IsMongoId()
  officerId: string;

  @IsMongoId()
  dependencyId: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class UpdateAccountDto extends PartialType(OmitType(CreateAccountDto, ['dependencyId'] as const)) {}

export class CreateAccountWithUserDto {
  @ValidateNested()
  @Type(() => CreateUserDto)
  @IsDefined()
  user: CreateUserDto;

  @ValidateNested()
  @Type(() => CreateAccountDto)
  @IsDefined()
  account: CreateAccountDto;
}

export class FilterAccountDto extends PaginationDto {
  @IsMongoId()
  @IsOptional()
  institution?: string;

  @IsMongoId()
  @IsOptional()
  dependency?: string;
}
