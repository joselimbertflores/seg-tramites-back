import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { procedureGroup, procedureState } from 'src/modules/procedures/schemas';

export class SearchProcedureDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  cite?: string;

  @IsEnum(procedureState)
  @IsOptional()
  state?: procedureState;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  reference?: string;

  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  start?: Date;

  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  end?: Date;

  @IsEnum(procedureGroup)
  @IsOptional()
  group?: procedureGroup;
}
