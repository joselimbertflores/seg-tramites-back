import { OmitType } from '@nestjs/mapped-types';
import { IsString, IsNotEmpty, IsObject, ValidateNested, IsEnum, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

import { PaginationDto } from 'src/modules/common';
import { docType } from '../schemas';

class OfficerProps {
  @IsString()
  @IsNotEmpty()
  fullname: string;

  @IsString()
  @IsNotEmpty()
  jobtitle: string;
}

export class CreateDocDto {
  @IsEnum(docType)
  type: docType;

  @IsString()
  reference: string;

  @IsObject()
  @ValidateNested()
  @Type(() => OfficerProps)
  sender: OfficerProps;

  @IsObject()
  @ValidateNested()
  @Type(() => OfficerProps)
  recipient: OfficerProps;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OfficerProps)
  via?: OfficerProps;

  @IsBoolean()
  @IsOptional()
  isGeneralCode = false;
}

export class UpdateDocDto extends OmitType(CreateDocDto, ['type', 'isGeneralCode']) {}

export class FilterDocsDto extends PaginationDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  year?: number;

  @IsEnum(docType)
  @IsOptional()
  type?: docType;

  @IsBoolean()
  @IsOptional()
  ownDocs = false;
}
