import { INestApplicationContext, UnauthorizedException } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions, Socket } from 'socket.io';
import { AuthHttpService } from './services/auth-http.service';
import { AuthSessionService } from './services/auth-session.service';

export class SessionIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly sessions: AuthSessionService,
    private readonly authHttp: AuthHttpService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, {
      ...options,
      ...(this.authHttp.uiOrigin ? { cors: { origin: this.authHttp.uiOrigin, credentials: true } } : {}),
      allowRequest: (request, callback) =>
        callback(null, !request.headers.origin || this.authHttp.trustedOrigins.includes(request.headers.origin)),
    });
    server.use(async (socket, next) => {
      try {
        await this.authenticate(socket);
        next();
      } catch (error) {
        const failure = new Error(error instanceof UnauthorizedException ? 'session_expired' : 'session_unavailable');
        next(failure);
      }
    });
    // Message guards do not cover idle sockets; revalidation also expires or refreshes those sessions.
    server.on('connection', (socket) => {
      let timer: NodeJS.Timeout;
      const check = async () => {
        try {
          await this.authenticate(socket);
          if (socket.connected) schedule();
        } catch (error) {
          socket.emit(error instanceof UnauthorizedException ? 'sessionExpired' : 'sessionUnavailable');
          socket.disconnect(true);
        }
      };
      const schedule = () => {
        const session = socket.data.session;
        const expiresAt = Math.min(session.expiresAt.getTime(), session.accessTokenExpiresAt?.getTime() ?? Infinity);
        timer = setTimeout(check, Math.max(100, Math.min(30_000, expiresAt - Date.now())));
        timer.unref();
      };
      schedule();
      socket.once('disconnect', () => clearTimeout(timer));
    });
    const onDeleted = (id: string) => {
      for (const socket of server.sockets.sockets.values()) {
        if (socket.data.session?._id === id) socket.disconnect(true);
      }
    };
    // Events only reach this process; sockets in other processes detect revocation through revalidation.
    this.sessions.events.on('deleted', onDeleted);
    server.engine.on('close', () => this.sessions.events.off('deleted', onDeleted));
    return server;
  }

  private async authenticate(socket: Socket): Promise<void> {
    const { user, session } = await this.sessions.resolve(this.authHttp.read(socket.handshake.headers.cookie));
    socket.data.user = user;
    socket.data.session = session;
  }
}
