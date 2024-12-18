import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

import { Account, Dependency, Institution, Officer, TypeProcedure } from 'src/modules/administration/schemas';
import { stateProcedure } from '../interfaces';
import { procedureStatus } from './procedure.schema';

abstract class Person {
  @Prop()
  firstname: string;

  @Prop()
  middlename: string;

  @Prop()
  lastname: string;

  @Prop()
  phone: string;

  @Prop()
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
  state: stateProcedure;
  reference: string;
  numberOfDocuments: string;
  group: string;
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
