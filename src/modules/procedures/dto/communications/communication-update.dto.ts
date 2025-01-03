import { ArrayMinSize, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCommunicationDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  state: any;
}

export class CancelMailsDto {
  @IsMongoId({ each: true })
  @ArrayMinSize(1)
  ids_mails: string[];
}
