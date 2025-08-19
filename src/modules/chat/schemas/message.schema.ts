import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

import { User } from 'src/modules/users/schemas';
import { Chat } from './chat.schema';

@Schema({ timestamps: { createdAt: 'sentAt' } })
export class Message extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Chat.name, required: true })
  chat: Chat;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name, required: true })
  sender: User;

  @Prop({ type: String })
  content?: string;

  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: User.name, default: [] })
  readBy: User[];

  sentAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
