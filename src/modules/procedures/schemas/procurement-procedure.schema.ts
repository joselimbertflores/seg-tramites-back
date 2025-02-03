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
  tipo: string;

  @Prop()
  apertura: string;

  @Prop()
  precio: string;

  @Prop()
  codigoProyecto: string;

  @Prop()
  plazo: string;

  @Prop()
  modalidad: string;

  @Prop()
  cuce: string;

  @Prop()
  precioAdjudicado: string;

  @Prop()
  tipoResolucion: string;

  @Prop()
  empreseAdjudicada: string;

}

export const ProcurementProcedureSchema = SchemaFactory.createForClass(ProcurementProcedure);
