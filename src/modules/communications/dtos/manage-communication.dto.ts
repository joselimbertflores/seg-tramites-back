import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsMongoId, ValidateNested } from 'class-validator';

export class CommunicationPropsDto {
  @IsMongoId()
  communicationId: string[];

  @IsMongoId()
  procedureId: string;
}

export class CancelCommunicationDto {
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CommunicationPropsDto)
  selected: CommunicationPropsDto[];
}
