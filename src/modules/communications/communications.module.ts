import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Communication, CommunicationSchema } from './schemas/communication.schema';
import { ProceduresModule } from '../procedures/procedures.module';
import { CommunicationController } from './controllers';
import { AdministrationModule } from '../administration/administration.module';
import { GroupwareModule } from '../groupware/groupware.module';
import { CommunicationService } from './services';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Communication.name, schema: CommunicationSchema }]),
    AdministrationModule,
    GroupwareModule,
    ProceduresModule,
  ],
  controllers: [CommunicationController],
  providers: [CommunicationService],
  exports: [MongooseModule],
})
export class CommunicationsModule {}
