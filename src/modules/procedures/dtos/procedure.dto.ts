import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProcedureDto {
  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsNotEmpty()
  numberOfDocuments: string;

  @IsString()
  @IsOptional()
  cite: string;
}
