import { Controller, Post, Body, Get, Put, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto, UpdateMyAccountDto } from './dto';
import { GetUserRequest, Public } from './decorators';
import { UserDocument } from 'src/modules/users/schemas';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post()
  @Public()
  login(@Body() body: AuthDto, @Ip() ip: string) {
    return this.authService.login(body, ip);
  }

  @Get()
  checkAuthStatus(@GetUserRequest() user: UserDocument) {
    return this.authService.checkAuthStatus(user);
  }

  @Put()
  updateMyAccount(@GetUserRequest('_id') id: string, @Body() data: UpdateMyAccountDto) {
    return this.authService.updateMyAccount(id, data);
  }
}
