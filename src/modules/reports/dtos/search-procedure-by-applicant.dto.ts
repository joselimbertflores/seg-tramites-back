import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class ApplicantProps {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  paterno?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  materno?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  dni?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  tipo?: string;
}

export class SearchProcedureByApplicantDto {
  @IsIn(['applicant', 'representative'])
  by: 'applicant' | 'representative';

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ApplicantProps)
  properties: ApplicantProps;
}
