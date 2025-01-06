import { ArrayMinSize, IsBoolean, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

import { procedureGroup } from 'src/modules/procedures/schemas';
import { PaginationDto } from 'src/common';
import { communicationStatus } from '../schemas';

export class SelectedCommunicationsDto {
  @ArrayMinSize(1, { message: 'Ningun elemento seleccionado' })
  @IsMongoId({ each: true })
  communicationIds: string[];
}

export class RejectCommunicationDto extends SelectedCommunicationsDto {
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class FilterInboxDto extends PaginationDto {
  @IsIn([communicationStatus.Pending, communicationStatus.Received])
  @IsOptional()
  status?: communicationStatus.Pending | communicationStatus.Received;

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
