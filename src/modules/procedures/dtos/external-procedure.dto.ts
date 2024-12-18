import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDefined,
  IsNotEmptyObject,
  IsObject,
  ValidateNested,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { ProcedureDto } from './procedure.dto';

class Person {
  @IsString()
  @IsNotEmpty()
  firstname: string;

  @IsString()
  @IsOptional()
  middlename?: string;

  @IsString()
  @IsOptional()
  lastname?: string;

  @IsString()
  @IsOptional()
  phone: string;

  @IsOptional()
  dni?: string;
}

class ApplicantDto extends Person {
  @IsOptional()
  dni?: string;

  @IsString()
  type: string;
}

class RepresentativeDto extends Person {}

export class CreateExternalProcedureDto extends ProcedureDto {
  @IsMongoId()
  type: string;

  @IsString()
  @IsNotEmpty()
  segment: string;

  @IsOptional()
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => RepresentativeDto)
  representative?: RepresentativeDto;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ApplicantDto)
  applicant: ApplicantDto;

  @IsArray()
  @IsString({ each: true })
  requirements: string[];
}

export class UpdateExternalProcedureDto extends PartialType(
  OmitType(CreateExternalProcedureDto, ['segment', 'type', 'requirements'] as const),
) {}
