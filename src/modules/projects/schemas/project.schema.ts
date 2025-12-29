import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Account } from 'src/modules/administration/schemas';

@Schema({ _id: false })
export class ProjectRequirement {
  @Prop()
  name: string;

  @Prop()
  officer: string;

  @Prop()
  reference: string;

  @Prop()
  date: Date;

  @Prop({ default: false })
  completed: boolean;
}
export const ProjectRequirementSchema = SchemaFactory.createForClass(ProjectRequirement);

@Schema({ _id: false })
export class ItemProcurement {
  @Prop()
  code: string;

  @Prop()
  name: string;

  @Prop()
  ff: string;

  @Prop()
  of: string;

  @Prop()
  amount: number;
}
const ItemsProcurementSchema = SchemaFactory.createForClass(ItemProcurement);

@Schema({ timestamps: true })
export class Project extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  code: string;

  @Prop()
  name: string;

  @Prop()
  mode: string;

  @Prop()
  aperturaProg: string;

  @Prop()
  type: string;

  @Prop()
  descripcionAperturaProg: string;

  @Prop()
  price: string;

  @Prop()
  price_updated: string;

  @Prop()
  reason: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
  })
  account: Account;

  @Prop({ type: [ProjectRequirementSchema], default: [] })
  requirements: ProjectRequirement[];

  @Prop({ type: [ItemsProcurementSchema], default: [] })
  items: ItemProcurement[];

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
