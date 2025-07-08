import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
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

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}

export class ReplyCommunicationDto extends CreateCommunicationDto {
  @IsMongoId()
  communicationId: string;
}
