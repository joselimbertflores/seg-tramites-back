import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { Request, Response } from 'express';
import { Socket } from 'socket.io';
import { AuthHttpService } from '../services/auth-http.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthSessionService } from '../services/auth-session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: AuthSessionService,
    private readonly authHttp: AuthHttpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient<Socket>();
      try {
        const { user, session } = await this.sessions.resolve(this.authHttp.read(client.handshake.headers.cookie));
        client.data.user = user;
        client.data.session = session;
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedException) client.disconnect(true);
        throw new WsException(error instanceof Error ? error.message : 'No fue posible comprobar la sesión');
      }
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // Public login/logout still change browser authentication and need origin checks.
    this.authHttp.assertRequestOrigin(request);
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    try {
      const { user, session } = await this.sessions.resolve(this.authHttp.read(request.headers.cookie));
      
      request['user'] = user;
      request['authSession'] = session;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) this.authHttp.clearSession(response);
      throw error;
    }
  }
}
