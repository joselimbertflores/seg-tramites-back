import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { DocumentProcurementDto } from 'src/modules/procedures/dtos';
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

export class CreateProjectDio {
  @IsString()
  name: string;

  @IsString()
  mode: string;

  @IsString()
  aperturaProg: string;

  @IsString()
  type: string;

  @IsString()
  descripcionAperturaProg: string;

  @IsNumber()
  @Type(() => Number)
  price: string;

  @IsNumber()
  @Type(() => Number)
  price_updated: string;

  @IsString()
  reason: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentProcurementDto)
  documents: DocumentProcurementDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}
export class UpdateProjectDto extends PartialType(CreateProjectDio) {}
