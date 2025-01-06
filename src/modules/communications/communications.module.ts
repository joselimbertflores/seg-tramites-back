import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArchiveController, CommunicationController, DocumentController, FolderController } from './controllers';
import { ArchiveService, CommunicationService, FolderService } from './services';
import { AdministrationModule } from '../administration/administration.module';
import { ProceduresModule } from '../procedures/procedures.module';
import { GroupwareModule } from '../groupware/groupware.module';
import { ProcessController } from './controllers/process.controller';
import { Archive, ArchiveSchema, Communication, CommunicationSchema, Folder, FolderSchema } from './schemas';
import { DocumentService } from '../procedures/services';

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
  controllers: [CommunicationController, ProcessController, DocumentController, FolderController, ArchiveController],
  providers: [CommunicationService, FolderService, ArchiveService, DocumentService],
  exports: [MongooseModule],
})
export class CommunicationsModule {}
