import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';

@Injectable()
export class WsJwtGuardGuard implements CanActivate {
  constructor(private jwtService: JwtService, private config: ConfigService, private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const client = context.switchToWs().getClient();
    const token = client.handshake.auth?.token;
    console.log(token);

    //   if (!token) throw new UnauthorizedException();

    //   try {
    //     const payload = this.jwtService.verify(token, {
    //       secret: this.config.get('JWT_KEY'),
    //     });

    //     client.data.user = payload;

    //     // Verificar roles
    //     const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
    //       context.getHandler(),
    //       context.getClass(),
    //     ]);

    //     if (requiredRoles && !requiredRoles.includes(payload.role)) {
    //       throw new ForbiddenException('No tienes permiso');
    //     }

    //     return true;
    //   } catch (e) {
    //     throw new UnauthorizedException('Token inválido');
    //   }
    // }
    return true;
  }
}
