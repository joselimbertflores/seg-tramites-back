import { OmitType, PartialType } from '@nestjs/mapped-types';

import { IsOptional, IsMongoId, IsString, IsNumber, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { ProcedureDto } from './procedure.dto';

class ItemDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  ff: string;

  @IsString()
  of: string;

  @IsNumber()
  @Type(() => Number)
  amount: number;
}

export class CreateProcurementProcedureDto extends ProcedureDto {
  @IsString()
  mode: string;

  @IsString()
  aperturaProg: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ItemDto)
  items: ItemDto[];

  @IsString()
  type: string;

  @IsString()
  descripcionAperturaProg: string;

  @IsString()
  metodoAdjudicacion: string;

  @IsString()
  formaAdjudicacion: string;

  @IsString()
  price: string;

  @IsString()
  deliveryTimeframe: string;

  @IsString()
  deliveryLocation: string;

  @IsString()
  warranty: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsMongoId()
  docId?: string;
}
export class UpdateProcurementProcedureDto extends PartialType(
  OmitType(CreateProcurementProcedureDto, ['docId', 'cite']),
) {}
