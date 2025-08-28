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
import { MessageType } from '../schemas';

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
}
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  content?: string;

  @IsEnum(MessageType)
  type: MessageType;

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => MessageMediaDto)
  @IsOptional()
  media?: MessageMediaDto;
}
