import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class RecipientDto {
  @IsMongoId()
  accountId: string;

  @IsBoolean()
  isOriginal: boolean;
}

export class CreateCommunicationDto {
  @IsMongoId()
  @IsOptional()
  communicationId?: string;

  @IsMongoId()
  @IsOptional()
  documentId?: string;

  @IsMongoId()
  procedureId: string;

  @IsString()
  @IsNotEmpty()
  attachmentsCount: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsOptional()
  internalNumber: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => RecipientDto)
  recipients: RecipientDto[];
}
