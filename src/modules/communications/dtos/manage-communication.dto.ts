import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common';
import { StatusMail } from 'src/modules/procedures/interfaces';

export class CancelCommunicationDto {
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  selected: string[];
}

export class RejectCommunicationDto {
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

export class FilterOutboxDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  term?: string;

  @IsEnum([StatusMail.Pending, StatusMail.Rejected])
  @IsOptional()
  status?: StatusMail.Pending | StatusMail.Rejected;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isOriginal?: boolean;
}
