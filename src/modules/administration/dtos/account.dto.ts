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

export class UpdateAccountDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  jobtitle: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsMongoId()
  @IsOptional()
  officerId?: string;
}

class UserDto extends OmitType(CreateUserDto, ['fullName'] as const) {}

export class CreateAccountWithUserDto {
  @ValidateNested()
  @Type(() => UserDto)
  @IsDefined()
  user: UserDto;

  @ValidateNested()
  @Type(() => CreateAccountDto)
  @IsDefined()
  account: CreateAccountDto;
}

export class UpdateAccountWithUserDto {
  @ValidateNested()
  @Type(() => UserDto)
  @IsDefined()
  @IsOptional()
  user?: UserDto;

  @ValidateNested()
  @Type(() => UpdateAccountDto)
  @IsDefined()
  @IsOptional()
  account?: UpdateAccountDto;
}

export class FilterAccountDto extends PaginationDto {
  @IsMongoId()
  @IsOptional()
  institution?: string;

  @IsMongoId()
  @IsOptional()
  dependency?: string;
}
