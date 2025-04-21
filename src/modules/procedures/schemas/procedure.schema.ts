import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { Account, Dependency, Institution, Officer } from 'src/modules/administration/schemas';

export enum procedureGroup {
  EXTERNAL = 'ExternalProcedure',
  INTERNAL = 'InternalProcedure',
  PROCUREMENT = 'ProcurementProcedure',
}

export enum procedureStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export enum procedureState {
  INSCRITO = 'INSCRITO',
  EN_REVISION = 'EN REVISION',
  OBSERVADO = 'OBSERVADO',
  CONCLUIDO = 'CONCLUIDO',
  ANULADO = 'ANULADO',
  SUSPENDIDO = 'SUSPENDIDO',
  RETIRADO = 'RETIRADO',
  ABANDONO = 'ABANDONO',
}

@Schema({ discriminatorKey: 'group', timestamps: true, collection: 'procedurebases' })
export class Procedure {
  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  })
  code: string;

  @Prop({ type: String, required: true, uppercase: true, trim: true })
  prefix: string;

  @Prop({ type: Number, required: true })
  correlative: number;

  @Prop({ type: String, default: '' })
  cite: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
  })
  account: Account;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Institution.name,
  })
  institution: Institution;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Dependency.name,
  })
  dependency: Dependency;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Officer.name,
  })
  officer?: Officer;

  @Prop({
    enum: Object.values(procedureState),
    default: procedureState.INSCRITO,
  })
  state: procedureState;

  @Prop({
    type: String,
    required: true,
  })
  reference: string;

  @Prop({
    type: String,
    required: true,
  })
  numberOfDocuments: string;

  @Prop({
    required: true,
    enum: procedureGroup,
  })
  group: procedureGroup;

  @Prop({
    enum: procedureStatus,
    default: procedureStatus.PENDING,
  })
  status: procedureStatus;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({ type: Date })
  completedAt: Date;
}
export const ProcedureSchema = SchemaFactory.createForClass(Procedure);
ProcedureSchema.index({ code: 1, group: 1 }, { unique: true });

export type ProcedureDocument = HydratedDocument<Procedure>;
