import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';

@Module({
  providers: [MessagingService],
  controllers: [MessagingController],
  exports:[MessagingService]
})
export class MessagingModule {}
