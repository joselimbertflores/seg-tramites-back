import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

import { User } from 'src/modules/users/schemas';

@Schema({ _id: false })
class LastMessage {
  @Prop()
  text: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  sender: User;

  @Prop()
  senderName: string;

  @Prop()
  createdAt: Date;
}
const LastMessageSchema = SchemaFactory.createForClass(LastMessage);

@Schema({ _id: false })
class Participant {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  user: User;

  @Prop({ type: Number, default: 0 })
  unreadCount: number;
}
const ParticipantSchema = SchemaFactory.createForClass(Participant);

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({ type: [ParticipantSchema], required: true })
  participants: Participant[];

  @Prop()
  name: string; // *Only for groups

  @Prop({ enum: ['private', 'group'], required: true })
  type: 'private' | 'group';

  @Prop({ type: LastMessageSchema })
  lastMessage: LastMessage;

  @Prop({ type: [{ user: { type: Types.ObjectId, ref: User.name }, readAt: Date }] })
  readBy: { user: Types.ObjectId; readAt: Date }[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
