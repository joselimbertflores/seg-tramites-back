import { Controller, Get } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private messagingService: MessagingService) {}
  @Get()
  sentMessage() {
    return this.messagingService.sendTextMessage({
      fullName: 'Jose Limbert FLores Suarez',
      code: 'APR-CTRL-2023-224424',
      state: 'ARCHIVADO',
    });
  }
}
