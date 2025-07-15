import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'instituciones' })
export class Institution extends Document {
  @Prop({
    type: String,
    required: true,
    uppercase: true,
  })
  nombre: string;

  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    unique: true,
  })
  sigla: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  activo: boolean;
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);
