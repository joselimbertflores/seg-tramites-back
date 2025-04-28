import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { Account, Dependency, Institution, Officer, TypeProcedure } from 'src/modules/administration/schemas';
import { procedureGroup, procedureState, procedureStatus } from './procedure.schema';

abstract class Person {
  @Prop({ trim: true, uppercase: true })
  firstname: string;

  @Prop({ trim: true, uppercase: true })
  middlename: string;

  @Prop({ trim: true, uppercase: true })
  lastname: string;

  @Prop()
  phone: string;

  @Prop({ trim: true })
  dni: string;
}

@Schema({ _id: false })
class Applicant extends Person {
  @Prop({
    enum: ['JURIDICO', 'NATURAL'],
    required: true,
  })
  type: string;
}
@Schema({ _id: false })
class Representative extends Person {}

const ApplicantSchema = SchemaFactory.createForClass(Applicant);
const RepresentativeSchema = SchemaFactory.createForClass(Representative);

@Schema()
export class ExternalProcedure {
  code: string;
  prefix: string;
  correlative: number;
  cite: string;
  account: Account;
  state: procedureState;
  reference: string;
  numberOfDocuments: string;
  group: procedureGroup;
  status: procedureStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date;
  institution: Institution;
  dependency: Dependency;
  officer: Officer;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: TypeProcedure.name,
  })
  type: TypeProcedure;

  @Prop({
    type: ApplicantSchema,
    required: true,
  })
  applicant: Applicant;

  @Prop({
    type: RepresentativeSchema,
    default: null,
  })
  representative?: Representative;

  @Prop({ type: [String], default: [] })
  requirements: string[];

  @Prop({
    type: Number,
    required: true,
  })
  pin: number;
}
export const ExternalProcedureSchema = SchemaFactory.createForClass(ExternalProcedure);

export type ExternalProcedureDocument = HydratedDocument<ExternalProcedure>;
