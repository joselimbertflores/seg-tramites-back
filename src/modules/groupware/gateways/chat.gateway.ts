import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

import { GroupwareService } from '../groupware.service';
import { IChatData } from '../interfaces';

@WebSocketGateway()
export class ChatGateway {
  @WebSocketServer() private server: Server;

  constructor(private groupwareService: GroupwareService) {}

  sendMessage(data: IChatData[]) {
    for (const { toUser, payload } of data) {
      const user = this.groupwareService.getUser(toUser);
      if (user) {
        this.server.to(user.socketIds).emit('sendMessage', payload);
      }
    }
  }

  readMessage(userIds: string[], chatId: string) {
    for (const userId of userIds) {
      const user = this.groupwareService.getUser(userId);
      if (user) {
        this.server.to(user.socketIds).emit('readMessage', chatId);
      }
    }
  }
}
