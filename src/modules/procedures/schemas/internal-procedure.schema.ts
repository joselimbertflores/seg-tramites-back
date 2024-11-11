import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Account, TypeProcedure } from 'src/modules/administration/schemas';
import { stateProcedure } from '../interfaces';

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
  type: TypeProcedure;
  account: Account;
  state: stateProcedure;
  reference: string;
  numberOfDocuments: string;
  group: string;

  @Prop({
    type: WorkerSchema,
    required: true,
  })
  emitter: Worker;

  @Prop({
    type: WorkerSchema,
    required: true,
  })
  receiver: Worker;
}

export const InternalProcedureSchema = SchemaFactory.createForClass(InternalProcedure);
