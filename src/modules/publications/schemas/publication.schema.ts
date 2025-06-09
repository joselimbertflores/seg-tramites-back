import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, HydratedDocument } from 'mongoose';
import { User } from 'src/modules/users/schemas';

export enum PublicationPriority {
  HIGH = 2,
  MEDIUM = 1,
  Low = 0,
}

@Schema({ _id: false })
class Attachment extends Document {
  @Prop({ type: String, required: true })
  originalName: string;

  @Prop({ type: String, required: true })
  fileName: string;
}
const AttachmentSchema = SchemaFactory.createForClass(Attachment);

export type PublicationDocument = HydratedDocument<Publication>;
@Schema({ timestamps: true })
export class Publication {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user: User;

  @Prop({
    type: String,
  })
  title: string;

  @Prop({
    type: String,
  })
  content: string;

  @Prop()
  image: string | null;

  @Prop({
    type: [AttachmentSchema],
    default: [],
  })
  attachments: Attachment[];

  @Prop({ enum: PublicationPriority })
  priority: PublicationPriority;

  @Prop({ type: Date, default: Date.now })
  startDate: Date;

  @Prop({ type: Date })
  expirationDate: Date;
}

export const PublicationSchema = SchemaFactory.createForClass(Publication);
