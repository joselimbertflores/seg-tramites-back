import { Module, Scope } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AdministrationModule } from 'src/modules/administration/administration.module';
import {
  DocumentService,
  ExternalService,
  InternalService,
  ObservationService,
  ProcedureFactoryService,
  ProcurementService,
} from './services';
import {
  InternalController,
  ExternalController,
  ProcedureController,
  DocumentController,
  ProcurementController,
} from './controllers';
import {
  Procedure,
  ProcedureSchema,
  ExternalProcedure,
  ExternalProcedureSchema,
  InternalProcedure,
  InternalProcedureSchema,
  Observation,
  ObservationSchema,
  Doc,
  DocSchema,
  ProcurementProcedure,
  ProcurementProcedureSchema,
} from './schemas';
import { PROCEDURE_FACTORY_TOKEN } from './domain';

@Module({
  imports: [
    ConfigModule,
    AdministrationModule,
    MongooseModule.forFeature([
      { name: Observation.name, schema: ObservationSchema },
      {
        name: Procedure.name,
        schema: ProcedureSchema,
        discriminators: [
          { name: InternalProcedure.name, schema: InternalProcedureSchema },
          { name: ExternalProcedure.name, schema: ExternalProcedureSchema },
          { name: ProcurementProcedure.name, schema: ProcurementProcedureSchema },
        ],
      },
      { name: Doc.name, schema: DocSchema },
    ]),
  ],
  controllers: [InternalController, ExternalController, ProcedureController, DocumentController, ProcurementController],
  providers: [
    {
      provide: PROCEDURE_FACTORY_TOKEN,
      scope: Scope.REQUEST,
      useFactory: (procedureFactoryService: ProcedureFactoryService) => {
        return procedureFactoryService.getService();
      },
      inject: [ProcedureFactoryService],
    },
    ProcedureFactoryService,
    ExternalService,
    InternalService,
    ProcurementService,
    ObservationService,
    DocumentService,
  ],
  exports: [MongooseModule, DocumentService, PROCEDURE_FACTORY_TOKEN],
})
export class ProceduresModule {}
