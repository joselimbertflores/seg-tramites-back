import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { Communication } from '../../communications/schemas';
import { GroupwareService } from '../groupware.service';
import { WsRequirePermission } from '../../auth/decorators';
import { SessionGuard } from '../../auth/guards/session.guard';
import { SystemResource } from '../../auth/constants';
import { IKickUserData } from '../interfaces';
import { User } from '../../users/schemas';

interface canceledCommunications {
  toUser: string;
  id: string;
}
@UseGuards(SessionGuard)
@WebSocketGateway()
export class GroupwareGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private groupwareService: GroupwareService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user: User = client.data.user;
      if (!user) throw new Error('Authenticated user missing');
      this.groupwareService.onClientConnected(client.id, { userId: user._id.toString(), fullname: user.fullname });
      this.server.emit('clientsList', this.groupwareService.getClients());
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.groupwareService.onClientDisconnected(client.id);
    client.broadcast.emit('clientsList', this.groupwareService.getClients());
  }

  sentCommunications(communications: { toUser: string; communication: Communication }[]): void {
    for (const { toUser, communication } of communications) {
      const user = this.groupwareService.getUser(toUser);
      if (!user) return;
      this.server.to(user.socketIds).emit('new-communication', communication);
    }
  }

  cancelCommunications(items: canceledCommunications[]): void {
    for (const { toUser, id } of items) {
      const user = this.groupwareService.getUser(toUser);
      if (user) {
        this.server.to(user.socketIds).emit('cancel-communication', id);
      }
    }
  }

  notifyUnarchive(id_dependency: string, id_mail: string) {
    this.server.to(id_dependency).emit('unarchive-mail', id_mail);
  }

  notifyNew(publication: object) {
    this.server.emit('news', publication);
  }

  @SubscribeMessage('kickUser')
  @WsRequirePermission(SystemResource.GROUPWARE, 'kick')
  handlekickUser(@MessageBody() { userIds, message }: IKickUserData) {
    const users = userIds.map((id) => this.groupwareService.remove(id)).filter((user) => !!user);
    users.forEach((user) => this.server.to(user.socketIds).emit('userKicked', message));
    return { test: `Total users kicked ${userIds.length}` };
  }
}
