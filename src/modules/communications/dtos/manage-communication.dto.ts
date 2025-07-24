import { ArrayMinSize, IsBoolean, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

import { procedureGroup } from 'src/modules/procedures/schemas';
import { PaginationDto } from 'src/modules/common';
import { SendStatus } from '../schemas';

export class SelectedCommunicationsDto {
  @ArrayMinSize(1, { message: 'Ningun elemento seleccionado' })
  @IsMongoId({ each: true })
  ids: string[];
}

export class RejectCommunicationDto extends SelectedCommunicationsDto {
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class FilterInboxDto extends PaginationDto {
  @IsIn([SendStatus.Pending, SendStatus.Received])
  @IsOptional()
  status?: SendStatus.Pending | SendStatus.Received;

  @IsEnum(procedureGroup)
  @IsOptional()
  group?: procedureGroup;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isOriginal?: boolean;
}
