import { OmitType, PartialType } from '@nestjs/mapped-types';
import { ProcedureDto } from './procedure.dto';
import { IsOptional, IsMongoId, IsString } from 'class-validator';

export class ProcurementProcedureDto extends ProcedureDto {}

export class CreateProcurementProcedureDto extends ProcedureDto {
  @IsString()
  @IsOptional()
  tipo: string;

  @IsString()
  @IsOptional()
  apertura: string;

  @IsString()
  @IsOptional()
  precio: string;

  @IsString()
  @IsOptional()
  codigoProyecto: string;

  @IsString()
  @IsOptional()
  plazo: string;

  @IsString()
  @IsOptional()
  cuce: string;

  @IsString()
  @IsOptional()
  modalidad: string;

  @IsString()
  @IsOptional()
  precioAdjudicado: string;

  @IsString()
  @IsOptional()
  tipoResolucion: string;

  @IsString()
  @IsOptional()
  empreseAdjudicada: string;

  @IsString()
  @IsOptional()
  representanteLegal: string;

  @IsOptional()
  @IsMongoId()
  docId?: string;
}
export class UpdateProcurementProcedureDto extends PartialType(
  OmitType(CreateProcurementProcedureDto, ['docId', 'cite']),
) {}
