import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { GroupwareService } from './groupware.service';
import { GroupwareGateway } from './groupware.gateway';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [],
  providers: [GroupwareGateway, GroupwareService],
  imports: [AuthModule, UsersModule],
  exports: [GroupwareGateway],
})
export class GroupwareModule {}
