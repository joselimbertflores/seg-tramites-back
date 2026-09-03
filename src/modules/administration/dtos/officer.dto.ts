import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class UpdateOfficerDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  telefono?: number | null;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
