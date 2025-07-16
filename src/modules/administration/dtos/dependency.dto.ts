import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
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

  @IsNumber()
  @Type(() => Number)
  code: number;
}

@ValidatorConstraint({ name: 'uniqueAreaCodes', async: false })
class UniqueAreaCodes implements ValidatorConstraintInterface {
  validate(areas: AreaDto[]): boolean {
    if (!Array.isArray(areas)) return false;
    const codes = areas.map((area) => area.code);
    const uniqueCodes = new Set(codes);
    return uniqueCodes.size === codes.length;
  }
  defaultMessage(): string {
    return 'Los codigos de area deben ser unicos';
  }
}
export class CreateDependencyDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  codigo: string;

  @IsMongoId()
  institucion: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AreaDto)
  @Validate(UniqueAreaCodes)
  areas: AreaDto[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateDependencyDto extends PartialType(OmitType(CreateDependencyDto, ['institucion'] as const)) {}

class PersonnelDto {
  @IsMongoId()
  accountId: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  area?: number;
}
export class AssignDependencyAreasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonnelDto)
  personnel: PersonnelDto[];
}
