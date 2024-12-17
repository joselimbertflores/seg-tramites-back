import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdministrationModule } from 'src/modules/administration/administration.module';

import { InternalController, ExternalController, ProcedureController } from './controllers';
import { ExternalService, InternalService, ObservationService } from './services';
import {
  Observation,
  ObservationSchema,
  InternalProcedure,
  InternalProcedureSchema,
  ExternalProcedure,
  ExternalProcedureSchema,
  Procedure,
  ProcedureSchema,
} from './schemas/index';
import { ProcedureService } from './services/procedure.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Observation.name, schema: ObservationSchema },
      {
        name: Procedure.name,
        schema: ProcedureSchema,
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
