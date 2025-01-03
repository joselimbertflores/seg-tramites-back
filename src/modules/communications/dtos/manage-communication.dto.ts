import { ArrayMinSize, IsBoolean, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { procedureGroup } from 'src/modules/procedures/schemas';
import { PaginationDto } from 'src/common';
import { communicationStatus } from '../schemas';
import { Transform } from 'class-transformer';

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
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  term?: string;

  @IsIn([communicationStatus.Pending, communicationStatus.Received])
  @IsOptional()
  status?: communicationStatus.Pending | communicationStatus.Received;

  @IsEnum(procedureGroup)
  @IsOptional()
  group?: procedureGroup;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    console.log(value);
    return value === 'true' || value === true
  })
  isOriginal?: boolean;
}
