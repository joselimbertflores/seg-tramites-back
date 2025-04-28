import { Type } from 'class-transformer';
import {
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class ApplicantProps {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  firstname?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  middlename?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  lastname?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  dni?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  type?: string;
}

export class SearchProcedureByApplicantDto {
  @IsIn(['applicant', 'representative'])
  by: 'applicant' | 'representative';

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ApplicantProps)
  properties: ApplicantProps;

  @IsMongoId()
  @IsOptional()
  typeProcedure?: string;
}
