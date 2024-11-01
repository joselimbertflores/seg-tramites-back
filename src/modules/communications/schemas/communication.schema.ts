import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

import { Account } from 'src/modules/administration/schemas';
import { ProcedureBase } from 'src/modules/procedures/schemas';
import { StatusMail } from '../../procedures/interfaces/status.enum';

@Schema({ _id: false })
class Participant extends Document {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
    required: true,
    index: true,
  })
  cuenta: Account;

  @Prop({
    type: String,
    required: true,
  })
  fullname: string;

  @Prop({
    type: String,
  })
  jobtitle?: string;
}
const ParticipantSchema = SchemaFactory.createForClass(Participant);

@Schema({ _id: false })
class ActionLog {
  @Prop({ type: String, required: true })
  manager: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Date, required: true })
  date: Date;
}
const ActionLogSchema = SchemaFactory.createForClass(ActionLog);

@Schema()
export class Communication extends Document {
  @Prop({
    type: ParticipantSchema,
    required: true,
  })
  sender: Participant;

  @Prop({
    type: ParticipantSchema,
    required: true,
  })
  recipient: Participant;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: ProcedureBase.name,
    required: true,
  })
  procedure: ProcedureBase;

  @Prop({
    type: String,
    required: true,
  })
  reference: string;

  @Prop({
    type: String,
    required: true,
  })
  attachmentsCount: string;

  @Prop({
    type: String,
  })
  internalNumber: string;

  @Prop({
    type: Date,
    required: true,
  })
  sentDate: Date;

  @Prop({
    type: Date,
  })
  receivedDate?: Date;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(StatusMail),
    default: StatusMail.Pending,
  })
  status: StatusMail;

  @Prop({
    type: ActionLogSchema,
  })
  actionLog: ActionLog;

  @Prop({ type: Boolean, default: false })
  isOriginal: boolean;
}

export const CommunicationSchema = SchemaFactory.createForClass(Communication);
