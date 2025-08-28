import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

import { User } from 'src/modules/users/schemas';
import { Chat } from './chat.schema';

interface media {
  fileName: string;
  originalName: string;
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}
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

  @Prop(
    raw({
      fileName: { type: String },
      originalName: { type: String },
    }),
  )
  media?: media;

  @Prop({
    type: String,
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  sentAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
