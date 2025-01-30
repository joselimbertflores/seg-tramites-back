import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';

export class FilterPublications extends PaginationDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  news?: boolean;
}
