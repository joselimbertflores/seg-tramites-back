import { ArrayMinSize, IsBoolean, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from 'src/common';
import { StatusMail } from 'src/modules/procedures/interfaces';

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

type procedureGroup = 'ExternalProcedure' | 'InternalProcedure';

export class FilterInboxDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  term?: string;

  @IsEnum([StatusMail.Pending, StatusMail.Received])
  @IsOptional()
  status?: StatusMail.Pending | StatusMail.Received;

  @IsIn(['ExternalProcedure', 'InternalProcedure'])
  @IsOptional()
  group: procedureGroup;

  @IsString()
  @IsOptional()
  from?: string;
}
