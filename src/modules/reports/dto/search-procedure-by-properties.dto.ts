import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { groupProcedure } from 'src/modules/procedures/domain/interfaces';
import { procedureState } from 'src/modules/procedures/schemas';

export class SearchProcedureByPropertiesDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  cite?: string;

  @IsEnum(Object.values(procedureState))
  @IsOptional()
  state?: procedureState;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  reference?: string;

  @IsMongoId()
  @IsOptional()
  type?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  start?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  end?: string;

  @IsEnum(Object.values(groupProcedure))
  @IsOptional()
  group?: groupProcedure;
}
