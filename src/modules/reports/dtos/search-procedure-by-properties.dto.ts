import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
  @IsDate()
  @Type(() => Date)
  start?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end?: Date;

  @IsEnum(procedureGroup)
  group: procedureGroup;
}
