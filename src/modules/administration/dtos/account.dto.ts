import { IsBoolean, IsDefined, IsMongoId, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OmitType, PartialType, PickType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

import { CreateUserDto } from 'src/modules/users/dtos';
import { PaginationDto } from 'src/modules/common';

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

export class UpdateAccountDto extends PartialType(PickType(CreateAccountDto, ['isVisible', 'jobtitle'] as const)) {
  @IsMongoId()
  @IsOptional()
  officerId?: string;
}

export class CreatePartialUserDto extends OmitType(CreateUserDto, ['fullname'] as const) {}
export class UpdatePartialUserDto extends PartialType(CreatePartialUserDto) {}

export class CreateAccountWithUserDto {
  @ValidateNested()
  @Type(() => CreatePartialUserDto)
  @IsDefined()
  user: CreatePartialUserDto;

  @ValidateNested()
  @Type(() => CreateAccountDto)
  @IsDefined()
  account: CreateAccountDto;
}

export class UpdateAccountWithUserDto {
  @ValidateNested()
  @Type(() => UpdatePartialUserDto)
  @IsDefined()
  user: UpdatePartialUserDto;

  @ValidateNested()
  @Type(() => UpdateAccountDto)
  @IsDefined()
  account: UpdateAccountDto;
}

export class FilterAccountDto extends PaginationDto {
  @IsMongoId()
  @IsOptional()
  institution?: string;

  @IsMongoId()
  @IsOptional()
  dependency?: string;
}
