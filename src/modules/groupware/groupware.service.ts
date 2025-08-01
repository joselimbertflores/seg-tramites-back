import { Injectable } from '@nestjs/common';
import { userSocket } from './interfaces/user-socket.interface';
import { JwtPayload } from 'src/modules/auth/interfaces/jwt.interface';

@Injectable()
export class GroupwareService {
  private clients: Record<string, userSocket> = {};

  onClientConnected(sockerId: string, payload: JwtPayload): void {
    const { socketIds } = this.clients[payload.userId] ?? { socketIds: [] };
    socketIds.push(sockerId);
    this.clients[payload.userId] = { ...payload, socketIds };
  }

  onClientDisconnected(socketId: string) {
    const client = Object.values(this.clients).find(({ socketIds }) => socketIds.includes(socketId));
    if (!client) return;
    this.clients[client.userId].socketIds = client.socketIds.filter((id) => id !== socketId);
    if (this.clients[client.userId].socketIds.length === 0) delete this.clients[client.userId];
  }

  remove(userId: string) {
    const client = this.clients[userId];
    if (client) delete this.clients[userId];
    return client;
  }

  getUser(userId: string): userSocket {
    return this.clients[userId];
  }

  getClients(): userSocket[] {
    return Object.values(this.clients);
  }
}
