import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OfficerController,
  DependencyController,
  InstitutionController,
  TypeProcedureController,
  AccountController,
  AssigationController,
} from './controllers';

import {
  Officer,
  OfficerSchema,
  Dependency,
  DependencySchema,
  Institution,
  InstitutionSchema,
  TypeProcedure,
  TypeProcedureSchema,
  Account,
  AccountSchema,
} from './schemas';

import {
  AccountService,
  DependencieService,
  InstitutionService,
  OfficerService,
  RrhhEmployeesClientService,
  TypeProcedureService,
} from './services';
import { UsersModule } from '../users/users.module';
import { PrinterModule } from '../printer/printer.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [
    DependencyController,
    InstitutionController,
    TypeProcedureController,
    OfficerController,
    AccountController,
    AssigationController,
  ],
  providers: [
    DependencieService,
    InstitutionService,
    TypeProcedureService,
    OfficerService,
    RrhhEmployeesClientService,
    AccountService,
  ],
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Officer.name, schema: OfficerSchema },
      { name: Dependency.name, schema: DependencySchema },
      { name: Institution.name, schema: InstitutionSchema },
      { name: TypeProcedure.name, schema: TypeProcedureSchema },
    ]),
    UsersModule,
    PrinterModule,
    NotificationsModule,
  ],
  exports: [
    MongooseModule,
    TypeProcedureService,
    InstitutionService,
    DependencieService,
    OfficerService,
    AccountService,
  ],
})
export class AdministrationModule {}
