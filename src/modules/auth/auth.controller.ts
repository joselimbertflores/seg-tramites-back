import { Controller, Post, Body, Get, Put, Req, Res, Header, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';

import { LocalLoginDto, ChangePasswordDto } from './dto';
import { GetUserRequest, Public } from './decorators';
import { AuthService } from './services/auth.service';
import { User } from '../users/schemas';
import { AuthHttpService } from './services/auth-http.service';
import { AuthSession } from './schemas/auth-session.schema';
import { AuthSessionService } from './services/auth-session.service';

type SessionRequest = Request & { authSession: AuthSession };

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessions: AuthSessionService,
    private authHttp: AuthHttpService,
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
    await this.sessions.delete(this.authHttp.read(request.headers.cookie));
    this.authHttp.clearSession(response);
    this.authHttp.clearTransaction(response);
  }
}
