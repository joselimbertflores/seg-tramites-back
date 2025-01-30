import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';
import { PaginationDto } from 'src/modules/common';

export class ManageDocDto extends PaginationDto {
  @IsInt()
  @Type(() => Number)
  year: number;
}
