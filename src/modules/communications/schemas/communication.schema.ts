import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { Account, Dependency, Institution } from 'src/modules/administration/schemas';
import { Procedure, ProcedureDocument } from 'src/modules/procedures/schemas';

export enum communicationStatus {
  Received = 'received',
  Pending = 'pending',
  Rejected = 'rejected',
  Forwarding = 'forwarding',
  Completed = 'completed',
  Archived = 'archived',
  AutoRejected = 'auto-rejected',
}

@Schema({ _id: false })
class Participant {
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

  @Prop()
  fullname: string;

  @Prop()
  jobtitle: string;
}
const ParticipantSchema = SchemaFactory.createForClass(Participant);

@Schema({ _id: false })
class ActionLog {
  @Prop()
  fullname: string;

  @Prop()
  description: string;

  @Prop()
  date: Date;
}
const ActionLogSchema = SchemaFactory.createForClass(ActionLog);

@Schema({ _id: false })
class ProcedureProps {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Procedure.name,
  })
  ref: ProcedureDocument;

  @Prop()
  code: string;

  @Prop()
  group: string;

  @Prop()
  reference: string;
}

const ProcedurePropsSchema = SchemaFactory.createForClass(ProcedureProps);

@Schema({ collection: 'newcommunications' })
export class Communication {
  @Prop({ type: ParticipantSchema })
  sender: Participant;

  @Prop({ type: ParticipantSchema })
  recipient: Participant;

  @Prop({ type: ProcedurePropsSchema })
  procedure: ProcedureProps;

  @Prop({
    enum: communicationStatus,
    default: communicationStatus.Pending,
    required: true,
  })
  status: communicationStatus;

  @Prop(ActionLogSchema)
  actionLog: ActionLog;

  @Prop()
  reference: string;

  @Prop()
  attachmentsCount: string;

  @Prop()
  internalNumber: string;

  @Prop({ type: Date, default: Date.now })
  sentDate: Date;

  @Prop()
  receivedDate?: Date;

  @Prop({ type: Boolean })
  isOriginal?: boolean;
}

export const CommunicationSchema = SchemaFactory.createForClass(Communication);

export type CommunicationDocument = HydratedDocument<Communication>;
