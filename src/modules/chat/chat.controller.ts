import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { UserService } from '../users/services';
import { GetUserRequest } from '../auth/decorators';
import { User } from '../users/schemas';
import { StartChatDto } from './dtos';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService, private userService: UserService) {}

  @Get('my')
  getMyChats(@GetUserRequest() user: User) {
    return this.chatService.getChatsByUser(user);
  }

  @Get('users/:term')
  searhcuser(@Param('term') term: string) {
    return this.userService.searchUser(term);
  }

  @Get('user/:id')
  getChatByUser(@Param('id') id: string, @GetUserRequest() user: User) {
    return this.chatService.getChatByUser(user.id, id);
  }

  @Post()
  createMessage(@Body() body: StartChatDto, @GetUserRequest() user: User) {
    return this.chatService.startChat(user, body);
  }

  @Get('messages/:chatId')
  getMessage(@Param('chatId') id: string) {
    return this.chatService.getmessages(id);
  }
}
