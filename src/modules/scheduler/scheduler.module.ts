import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  providers: [SchedulerService],
  imports: [CommunicationsModule],
})
export class SchedulerModule {}
