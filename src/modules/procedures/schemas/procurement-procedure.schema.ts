import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Account, Institution, Dependency, Officer } from 'src/modules/administration/schemas';
import { procedureGroup, procedureState, procedureStatus } from './procedure.schema';

@Schema()
export class ProcurementProcedure {
  code: string;
  prefix: string;
  correlative: number;
  reference: string;
  cite: string;
  numberOfDocuments: string;
  account: Account;
  state: procedureState;
  group: procedureGroup;
  status: procedureStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date;
  institution: Institution;
  dependency: Dependency;
  officer: Officer;

  @Prop()
  mode: string;

  @Prop()
  aperturaProg: string;

  @Prop()
  items: string;

  @Prop()
  type: string;

  @Prop()
  descripcionAperturaProg: string;

  @Prop()
  metodoAdjudicacion: string;

  @Prop()
  formaAdjudicacion: string;

  @Prop()
  price: string;

  @Prop()
  deliveryTimeframe: string;

  @Prop()
  deliveryLocation: string;

  @Prop()
  warranty: string;

  @Prop()
  reason: string;
}

export const ProcurementProcedureSchema = SchemaFactory.createForClass(ProcurementProcedure);
