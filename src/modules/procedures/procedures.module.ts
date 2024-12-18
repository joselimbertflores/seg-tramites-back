import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AdministrationModule } from 'src/modules/administration/administration.module';
import { InternalController, ExternalController, ProcedureController } from './controllers';
import { ExternalService, InternalService, ObservationService, ProcedureService } from './services';
import {
  Procedure,
  ProcedureSchema,
  ExternalProcedure,
  ExternalProcedureSchema,
  InternalProcedure,
  InternalProcedureSchema,
  Observation,
  ObservationSchema,
} from './schemas';

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
        ],
      },
    ]),
  ],
  controllers: [InternalController, ExternalController, ProcedureController],
  providers: [ExternalService, InternalService, ObservationService, ProcedureService],
  exports: [MongooseModule, ProcedureService],
})
export class ProceduresModule {}
