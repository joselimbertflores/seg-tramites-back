import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArchiveController, CommunicationController, FolderController, ProcessController } from './controllers';
import { AdministrationModule } from '../administration/administration.module';
import { ProceduresModule } from '../procedures/procedures.module';
import { GroupwareModule } from '../groupware/groupware.module';
import { Archive, ArchiveSchema, Communication, CommunicationSchema, Folder, FolderSchema } from './schemas';
import { ArchiveService, CommunicationService, FolderService, OutboxService } from './services';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Communication.name, schema: CommunicationSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: Archive.name, schema: ArchiveSchema },
    ]),
    AdministrationModule,
    GroupwareModule,
    ProceduresModule,
  ],
  controllers: [CommunicationController, ProcessController, FolderController, ArchiveController],
  providers: [CommunicationService, FolderService, ArchiveService, OutboxService],
  exports: [MongooseModule],
})
export class CommunicationsModule {}
