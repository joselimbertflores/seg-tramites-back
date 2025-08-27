import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Chat, ChatSchema, Message, MessageSchema } from './schemas';
import { UsersModule } from '../users/users.module';
import { GroupwareModule } from '../groupware/groupware.module';
import { AdministrationModule } from '../administration/administration.module';
import { FilesModule } from '../files/files.module';

@Module({
  controllers: [ChatController],
  providers: [ChatService],
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    UsersModule,
    FilesModule,
    GroupwareModule,
    AdministrationModule,
  ],
})
export class ChatModule {}
