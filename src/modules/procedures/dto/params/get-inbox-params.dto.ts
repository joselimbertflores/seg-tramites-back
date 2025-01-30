import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';

export class GetInboxParamsDto extends PaginationDto {
  status: any;
}
