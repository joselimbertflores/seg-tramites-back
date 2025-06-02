import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ResourceFileDocument = HydratedDocument<ResourceFile>;

@Schema({ timestamps: true })
export class ResourceFile {
  @Prop({ required: true, unique: true })
  originalName: string;

  @Prop({ required: true, unique: true })
  fileName: string;

  @Prop({ required: true, trim: true })
  category: string;
}

export const ResourceFileSchema = SchemaFactory.createForClass(ResourceFile);
