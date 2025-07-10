import { Module } from '@nestjs/common';


import { ReportCommomController, ReportCommunicationsController, ReportProceduresController } from './controllers';
import { ReportCommunicationsService, ReportProcedureService } from './services';
import { AdministrationModule } from '../administration/administration.module';
import { CommunicationsModule } from '../communications/communications.module';
import { ProceduresModule } from '../procedures/procedures.module';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [ReportProceduresController, ReportCommunicationsController, ReportCommomController],
  providers: [ReportCommunicationsService, ReportProcedureService],
  imports: [ProceduresModule, UsersModule, AdministrationModule, CommunicationsModule],
})
export class ReportsModule {}
