import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

import { Account, Dependency, Institution } from 'src/modules/administration/schemas';
import { Procedure, ProcedureDocument } from 'src/modules/procedures/schemas';
import { StatusMail } from 'src/modules/procedures/interfaces';

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
    type: String,
    required: true,
    enum: Object.values(StatusMail),
    default: StatusMail.Pending,
  })
  status: StatusMail;

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

  @Prop({ type: Boolean, default: false })
  isOriginal: boolean;
}

export const CommunicationSchema = SchemaFactory.createForClass(Communication);

export type CommunicationDocument = HydratedDocument<Communication>;
