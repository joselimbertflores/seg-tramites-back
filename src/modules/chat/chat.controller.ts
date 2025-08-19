import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { GetUserRequest } from '../auth/decorators';
import { UserService } from '../users/services';
import { ChatService } from './chat.service';
import { User } from '../users/schemas';
import { CreateMessageDto } from './dtos';
import { PaginationDto } from '../common';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService, private userService: UserService) {}

  @Get('start/:receiverId')
  fintOrCreateChat(@GetUserRequest() user: User, @Param('receiverId') receiverId: string) {
    return this.chatService.findOrCreateChat(user, receiverId);
  }

  @Get('my')
  getMyChats(@GetUserRequest() user: User) {
    return this.chatService.getChatsByUser(user);
  }

  @Get('users/:term')
  searhcuser(@Param('term') term: string) {
    return this.userService.searchUser(term);
  }

  @Get(':chatId/messages')
  getChatMessages(@Param('chatId') id: string, @Query() paginationDto: PaginationDto) {
    return this.chatService.getChatMessages(id, paginationDto);
  }

  @Post(':chatId/messages')
  async sendMessage(@Param('chatId') chatId: string, @Body() body: CreateMessageDto, @GetUserRequest() user: User) {
    const { chatForMe, chatForOthers } = await this.chatService.sendMessage(chatId, body, user);
    return chatForMe;
  }
}
