import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { GetUserRequest } from '../auth/decorators';
import { UserService } from '../users/services';
import { ChatService } from './chat.service';
import { User } from '../users/schemas';
import { CreateMessageDto } from './dtos';
import { PaginationDto } from '../common';
import { GroupwareGateway } from '../groupware/groupware.gateway';

@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private userService: UserService,
    private groupwareGateway: GroupwareGateway,
  ) {}

  @Get('users/:term')
  searchcuser(@Param('term') term: string) {
    return this.userService.searchUser(term);
  }

  @Get('start/:receiverId')
  fintOrCreateChat(@GetUserRequest() user: User, @Param('receiverId') receiverId: string) {
    return this.chatService.findOrCreateChat(user, receiverId);
  }

  @Get()
  getChats(@GetUserRequest() user: User) {
    return this.chatService.getChats(user);
  }

  @Get(':chatId/messages')
  getChatMessages(@Param('chatId') id: string, @GetUserRequest() user: User, @Query() paginationDto: PaginationDto) {
    return this.chatService.getChatMessages(id, user, paginationDto);
  }

  @Post(':chatId/messages')
  async sendMessage(@Param('chatId') chatId: string, @Body() body: CreateMessageDto, @GetUserRequest() user: User) {
    const { chatForMe, chatForOthers } = await this.chatService.sendMessage(chatId, body, user);
    this.groupwareGateway.sentMessage(chatForOthers);
    return chatForMe;
  }

  @Patch(':chatId/read')
  async markChatAsRead(@Param('chatId') chatId: string, @GetUserRequest() user: User) {
    const { message, participantId } = await this.chatService.markChatAsRead(chatId, user);
    this.groupwareGateway.readMessage(participantId, chatId);
    return { message };
  }
}
