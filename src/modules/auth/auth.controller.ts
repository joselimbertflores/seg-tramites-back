import { Controller, Post, Body, Get, Put, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto, UpdateMyUserDto } from './dto';
import { GetUserRequest, Public } from './decorators';
import { User } from '../users/schemas';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post()
  @Public()
  login(@Body() body: AuthDto, @Ip() ip: string) {
    return this.authService.login(body, ip);
  }

  @Get()
  checkAuthStatus(@GetUserRequest() user: User) {
    return this.authService.checkAuthStatus(user);
  }

  @Put()
  updateMyUser(@GetUserRequest('_id') id: string, @Body() data: UpdateMyUserDto) {
    return this.authService.updateMyUser(id, data);
  }
}
