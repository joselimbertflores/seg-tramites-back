import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { GroupwareService } from './groupware.service';
import { UsersModule } from '../users/users.module';
import { ChatGateway, GroupwareGateway } from './gateways';

@Module({
  controllers: [],
  providers: [GroupwareGateway, GroupwareService, ChatGateway],
  imports: [AuthModule, UsersModule],
  exports: [GroupwareGateway, ChatGateway],
})
export class GroupwareModule {}
