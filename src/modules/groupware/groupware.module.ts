import { Module } from '@nestjs/common';
import { GroupwareService } from './groupware.service';
import { GroupwareGateway } from './groupware.gateway';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [],
  providers: [GroupwareGateway, GroupwareService],
  imports: [AuthModule, UsersModule],
  exports: [GroupwareGateway],
})
export class GroupwareModule {}
