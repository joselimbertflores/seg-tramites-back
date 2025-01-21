import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

class AreaDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @Type(() => Number)
  code: number;
}

@ValidatorConstraint({ name: 'uniqueAreaCodes', async: false })
export class UniqueAreaCodes implements ValidatorConstraintInterface {
  validate(areas: AreaDto[]): boolean {
    if (!Array.isArray(areas)) return false;
    const codes = areas.map((area) => area.code);
    const uniqueCodes = new Set(codes);
    return uniqueCodes.size === codes.length;
  }
  defaultMessage(): string {
    return 'Codes must be unique';
  }
}
export class CreateDependencyDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  sigla: string;

  @IsNotEmpty()
  @IsString()
  codigo: string;

  @IsMongoId()
  institucion: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AreaDto)
  @Validate(UniqueAreaCodes)
  areas: AreaDto[];
}

export class UpdateDependencyDto extends PartialType(OmitType(CreateDependencyDto, ['institucion'] as const)) {}
