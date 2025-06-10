import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ProceduresModule } from 'src/modules/procedures/procedures.module';
import { AdministrationModule } from 'src/modules/administration/administration.module';
import { UsersModule } from 'src/modules/users/users.module';
import { CommunicationsModule } from '../communications/communications.module';


@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  imports: [ProceduresModule, UsersModule, AdministrationModule, CommunicationsModule],
})
export class ReportsModule {}
