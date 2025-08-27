import { Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class StartChatDto {
  @IsMongoId()
  @IsOptional()
  chatId?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  receiverId: string;
}

export class MessageMediaDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  originalName: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  content?: string;

  @IsEnum(['text', 'media'])
  type: 'text' | 'media';

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => MessageMediaDto)
  @IsOptional()
  media: MessageMediaDto;
}
