import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Communication } from '../../communications/schemas';
import { GroupwareService } from '../groupware.service';
import { WsRequirePermission } from '../decorators';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { SystemResource } from '../../auth/constants';
import { IKickUserData } from '../interfaces';
import { JwtPayload } from '../../auth/interfaces';
import { User } from '../../users/schemas';

interface canceledCommunications {
  toUser: string;
  id: string;
}
@UseGuards(WsJwtGuard)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GroupwareGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private groupwareService: GroupwareService,
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth.token;
      const decoded: JwtPayload = this.jwtService.verify(token);
      const user = await this.userModel.exists({ _id: decoded.userId, isActive: true });
      if (!user) throw new Error('Inactive user');
      client.data['user'] = decoded;
      this.groupwareService.onClientConnected(client.id, decoded);
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
