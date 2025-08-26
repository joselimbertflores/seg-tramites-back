import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  InboxController,
  FolderController,
  OutboxController,
  ArchiveController,
  ProcessController,
} from './controllers';
import { ArchiveService, InboxService, FolderService, OutboxService } from './services';

import { GroupwareModule } from '../groupware/groupware.module';
import { ProceduresModule } from '../procedures/procedures.module';
import { AdministrationModule } from '../administration/administration.module';
import { Archive, ArchiveSchema, Communication, CommunicationSchema, Folder, FolderSchema } from './schemas';

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
  controllers: [InboxController, ProcessController, FolderController, ArchiveController, OutboxController],
  providers: [InboxService, FolderService, ArchiveService, OutboxService],
  exports: [MongooseModule],
})
export class CommunicationsModule {}
