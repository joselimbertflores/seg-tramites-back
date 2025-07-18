import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateRequirementDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsBoolean()
  activo: boolean;
}

export class CreateTypeProcedureDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  segmento: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequirementDto)
  requerimientos: CreateRequirementDto[];

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}

export class UpdateTypeProcedureDto extends PartialType(
  OmitType(CreateTypeProcedureDto, ['segmento'] as const),
) {}
