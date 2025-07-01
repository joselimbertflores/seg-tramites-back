import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ProceduresModule } from 'src/modules/procedures/procedures.module';
import { AdministrationModule } from 'src/modules/administration/administration.module';
import { UsersModule } from 'src/modules/users/users.module';
import { CommunicationsModule } from '../communications/communications.module';
import { ReportProceduresController } from './controllers/report-procedures.controller';
import { ReportCommunicationsController } from './controllers/report-communications.controller';
import { ReportCommunicationsService } from './services/report-communications.service';
import { ReportCommomController } from './controllers/report-commom.controller';
import { ReportProcedureService } from './services/report-procedure.service';


@Module({
  controllers: [ReportsController, ReportProceduresController, ReportCommunicationsController, ReportCommomController],
  providers: [ReportsService, ReportCommunicationsService, ReportProcedureService],
  imports: [ProceduresModule, UsersModule, AdministrationModule, CommunicationsModule],
})
export class ReportsModule {}
