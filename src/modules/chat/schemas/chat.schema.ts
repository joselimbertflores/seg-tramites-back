import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

import { User } from 'src/modules/users/schemas';

@Schema({ _id: false })
class LastMessage {
  @Prop()
  content: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  sender: User;

  @Prop()
  senderName: string;

  @Prop()
  sentAt: Date;
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

  @Prop({ enum: ['private', 'group'], required: true })
  type: 'private' | 'group';

  @Prop({ type: Date, default: Date.now })
  lastActivity: Date;

  @Prop({ type: Boolean, default: false })
  hasMessages: boolean;

  @Prop()
  name?: string; // only for group chats

  @Prop({ type: LastMessageSchema })
  lastMessage?: LastMessage;

  createdAt: Date;
  updatedAt: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
