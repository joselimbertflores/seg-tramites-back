import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdministrationModule } from 'src/modules/administration/administration.module';

import { InternalController, ExternalController, ProcedureController } from './controllers';
import { ExternalService, InternalService, ObservationService } from './services';
import {
  ExternalDetail,
  ExternalDetailSchema,
  Procedure,
  ProcedureSchema,
  InternalDetail,
  InternalDetailSchema,
  Observation,
  ObservationSchema,
  ProcedureBase,
  ProcedureBaseSchema,
  InternalProcedure,
  InternalProcedureSchema,
  ExternalProcedure,
  ExternalProcedureSchema,
} from './schemas/index';
import { ProcedureService } from './services/procedure.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Procedure.name, schema: ProcedureSchema },
      { name: InternalDetail.name, schema: InternalDetailSchema },
      { name: ExternalDetail.name, schema: ExternalDetailSchema },
      { name: Observation.name, schema: ObservationSchema },
      {
        name: ProcedureBase.name,
        schema: ProcedureBaseSchema,
        discriminators: [
          { name: InternalProcedure.name, schema: InternalProcedureSchema },
          { name: ExternalProcedure.name, schema: ExternalProcedureSchema },
        ],
      },
    ]),
    AdministrationModule,
  ],
  controllers: [InternalController, ExternalController, ProcedureController],
  providers: [ExternalService, InternalService, ObservationService, ProcedureService],
  exports: [MongooseModule, ProcedureService],
})
export class ProceduresModule {}
