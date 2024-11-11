import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Account, TypeProcedure } from 'src/modules/administration/schemas';
import { stateProcedure } from '../interfaces';

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
  type: TypeProcedure;
  account: Account;
  state: stateProcedure;
  reference: string;
  numberOfDocuments: string;
  group: string;

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
