import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Account, Dependency, Institution, Officer } from 'src/modules/administration/schemas';
import { stateProcedure } from '../interfaces';
import { procedureStatus } from './procedure.schema';

@Schema({ _id: false })
class Worker {
  @Prop({
    type: String,
    required: true,
    uppercase: true,
  })
  fullname: string;

  @Prop({
    type: String,
    required: true,
    uppercase: true,
  })
  jobtitle: string;
}
const WorkerSchema = SchemaFactory.createForClass(Worker);

@Schema()
export class InternalProcedure {
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

  @Prop(WorkerSchema)
  sender: Worker;

  @Prop(WorkerSchema)
  recipient: Worker;
}

export const InternalProcedureSchema = SchemaFactory.createForClass(InternalProcedure);
