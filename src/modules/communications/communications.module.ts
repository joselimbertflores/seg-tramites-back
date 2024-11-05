import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Communication, CommunicationSchema } from './schemas/communication.schema';
import { CommunicationController } from './controllers';
import { CommunicationService } from './services';
import { AdministrationModule } from '../administration/administration.module';
import { ProceduresModule } from '../procedures/procedures.module';
import { GroupwareModule } from '../groupware/groupware.module';
import { ProcessController } from './controllers/process.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Communication.name, schema: CommunicationSchema }]),
    AdministrationModule,
    GroupwareModule,
    ProceduresModule,
  ],
  controllers: [CommunicationController, ProcessController],
  providers: [CommunicationService],
  exports: [MongooseModule],
})
export class CommunicationsModule {}
