import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProcedureDto {
  @IsString()
  @IsOptional()
  cite: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsNotEmpty()
  numberOfDocuments: string;
}
