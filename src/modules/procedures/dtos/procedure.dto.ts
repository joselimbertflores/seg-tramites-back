import { IsString, IsNotEmpty } from 'class-validator';

export class ProcedureDto {
  @IsString()
  cite: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsNotEmpty()
  numberOfDocuments: string;
}
