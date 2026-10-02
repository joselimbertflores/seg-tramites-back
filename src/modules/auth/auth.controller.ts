import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Get,
  Put,
  Req,
  Res,
  Header,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { LocalLoginDto, ChangePasswordDto } from './dto';
import { GetUserRequest, Public } from './decorators';
import { AuthService } from './services/auth.service';
import { User } from '../users/schemas';
import { AuthHttpService } from './services/auth-http.service';
import { AuthSession } from './schemas/auth-session.schema';
import { AuthSessionService } from './services/auth-session.service';
import { IdentityHubOAuthService } from './services/identity-hub-oauth.service';
import { TokenVerifierService } from './services/token-verifier.service';

type SessionRequest = Request & { authSession: AuthSession };

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private sessions: AuthSessionService,
    private authHttp: AuthHttpService,
    private identityHub: IdentityHubOAuthService,
    private verifier: TokenVerifierService,
  ) {}

  @Post()
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body() body: LocalLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { user, session } = await this.authService.login(body);
    try {
      const state = await this.authService.checkAuthStatus(user, session.authMethod);
      await this.sessions.delete(this.authHttp.read(request.headers.cookie));
      this.authHttp.clearTransaction(response);
      this.authHttp.setSession(response, session._id, session.expiresAt);
      return state;
    } catch (error) {
      await this.sessions.delete(session._id);
      throw error;
    }
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  checkAuthStatus(@GetUserRequest() user: User, @Req() request: SessionRequest) {
    return this.authService.checkAuthStatus(user, request.authSession.authMethod);
  }

  @Put()
  changePassword(@GetUserRequest('_id') id: string, @Body() data: ChangePasswordDto, @Req() request: SessionRequest) {
    return this.authService.changePassword(id, data, request.authSession.authMethod);
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const id = this.authHttp.read(request.headers.cookie);
    let session: AuthSession;
    try {
      session = await this.sessions.findForLogout(id);
    } finally {
      try {
        await this.sessions.delete(id);
      } finally {
        this.authHttp.clearSession(response);
        this.authHttp.clearTransaction(response);
      }
    }
    if (session?.authMethod === 'IDENTITY_HUB' && session.identitySid) {
      void this.identityHub.logoutSession(session.identitySid).catch((error) => {
        this.logger.warn(
          `No fue posible cerrar la sesión en Identity Hub: ${error instanceof Error ? error.message : error}`,
        );
      });
    }
  }

  @Post('backchannel-logout')
  @Public()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async backchannelLogout(@Body() body: { logout_token?: unknown }) {
    if (typeof body?.logout_token !== 'string' || !body.logout_token) {
      throw new BadRequestException('logout_token es obligatorio');
    }
    const sid = await this.verifier.verifyLogoutToken(body.logout_token);
    await this.sessions.deleteByIdentitySid(sid);
  }
}
