import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

import { User } from 'src/modules/users/schemas';
import { Chat } from './chat.schema';

// @Schema({ _id: false })
// class ReadBy {
//   @Prop({ type: Types.ObjectId, ref: User.name })
//   user: User;

//   @Prop()
//   readAt: Date;
// }
// const ReadBySchema = SchemaFactory.createForClass(ReadBy);

@Schema({ timestamps: { createdAt: 'sentAt' } })
export class Message extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Chat.name, required: true })
  chat: Chat;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  sender: User;

  @Prop({ type: String })
  content?: string;

  // @Prop({ type: [ReadBySchema], default: [] })
  // readBy: ReadBy[];

  sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
