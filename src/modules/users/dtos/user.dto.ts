import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  fullname: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsMongoId()
  role: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
