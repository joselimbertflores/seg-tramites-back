import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Dependency } from 'src/modules/administration/schemas';

@Schema()
export class Folder {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, trim: true })
  managerName: string | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Dependency.name,
    required: true,
  })
  dependency: Dependency;
}

export const FolderSchema = SchemaFactory.createForClass(Folder);
FolderSchema.index({ name: 1, dependency: 1 }, { unique: true });

export type FolderDocument = HydratedDocument<Folder>;
