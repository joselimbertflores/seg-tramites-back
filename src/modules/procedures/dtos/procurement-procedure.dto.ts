import { OmitType, PartialType } from '@nestjs/mapped-types';

import {
  IsOptional,
  IsMongoId,
  IsString,
  IsNumber,
  ArrayMinSize,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
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

class OfficerProps {
  @IsString()
  fullname: string;

  @IsString()
  jobtitle: string;
}

export class DocumentProcurementDto {
  @IsString()
  reference: string;

  @IsObject()
  @ValidateNested()
  @Type(() => OfficerProps)
  @IsOptional()
  sender?: OfficerProps;

  @IsObject()
  @ValidateNested()
  @Type(() => OfficerProps)
  @IsOptional()
  recipient?: OfficerProps;

  @IsObject()
  @ValidateNested()
  @Type(() => OfficerProps)
  @IsOptional()
  via?: OfficerProps;

  @IsString()
  @IsOptional()
  cite?: string;

  @IsOptional()
  date?: Date;
}

export class UpdatedDocumentProcurementDto {
  @IsNumber()
  @Type(() => Number)
  index: number;

  @IsObject()
  @ValidateNested()
  @Type(() => DocumentProcurementDto)
  properties: DocumentProcurementDto;
}

export class CreateProcurementProcedureDto extends ProcedureDto {
  @IsString()
  mode: string;

  @IsString()
  aperturaProg: string;

  @IsArray()
  @ValidateNested({ each: true })
  // @ArrayMinSize(1)
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

  @IsNumber()
  @Type(() => Number)
  price: string;

  @IsString()
  deliveryTimeframe: string;

  @IsString()
  deliveryLocation: string;

  @IsString()
  warranty: string;

  @IsString()
  reason: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentProcurementDto)
  documents: DocumentProcurementDto[];
}
export class UpdateProcurementProcedureDto extends PartialType(OmitType(CreateProcurementProcedureDto, ['cite'])) {}
