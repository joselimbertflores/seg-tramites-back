import {  IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
