import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';

import { User } from 'src/modules/users/schemas';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService, @InjectModel(User.name) private userModel: Model<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();

    const token = client.handshake.auth?.token;

    if (!token) throw new WsException('Invalid credentials.');

    try {
      const payload = this.jwtService.verify(token);

      const user = await this.userModel.findById(payload.userId).select('-password').populate('role');

      if (!user) throw new WsException('User not found.');

      client.data['user'] = user;

      return true;
    } catch (e) {
      throw new WsException('Invalid token');
    }
  }
}
