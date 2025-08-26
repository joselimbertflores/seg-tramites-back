import { Controller, Post, Body, Get, Put } from '@nestjs/common';

import { AuthDto, UpdateMyUserDto } from './dto';
import { GetUserRequest, Public } from './decorators';
import { AuthService } from './auth.service';
import { User } from '../users/schemas';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post()
  @Public()
  login(@Body() body: AuthDto) {
    return this.authService.login(body);
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
