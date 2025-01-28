import { IsString, IsNotEmpty, IsObject, ValidateNested, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
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
