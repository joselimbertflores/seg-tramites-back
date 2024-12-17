import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { Account, Dependency, Institution, Officer } from 'src/modules/administration/schemas';
import { stateProcedure } from '../interfaces';

export enum groupProcedure {
  EXTERNAL = 'ExternalProcedure',
  INTERNAL = 'InternalProcedure',
}
@Schema({ discriminatorKey: 'group', timestamps: true, collection: 'procedurebases' })
export class Procedure {
  @Prop({
    type: String,
    required: true,
  })
  code: string;

  @Prop({ type: String, required: true })
  prefix: string;

  @Prop({ type: Number, required: true })
  correlative: number;

  @Prop({ type: String, default: 'S/C' })
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
    type: String,
    enum: Object.values(stateProcedure),
    default: stateProcedure.INSCRITO,
  })
  state: stateProcedure;

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
    type: String,
    required: true,
    enum: groupProcedure,
  })
  group: groupProcedure;

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
