import { Prop, Schema, SchemaFactory, Virtual } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'funcionarios' })
export class Officer extends Document {
  @Prop({
    type: String,
    required: true,
    uppercase: true,
  })
  nombre: string;

  @Prop({
    type: String,
    uppercase: true,
  })
  paterno: string | null;

  @Prop({
    type: String,
    uppercase: true,
  })
  materno: string | null;

  @Prop({
    type: Number,
  })
  telefono: number | null;

  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
  })
  dni: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  activo: boolean;

  @Prop({
    type: String,
    trim: true,
  })
  email?: string | null;

  @Virtual({
    get: function (this: Officer) {
      return [this.nombre, this.paterno, this.materno]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ');
    },
  })
  fullName: string;
}

export const OfficerSchema = SchemaFactory.createForClass(Officer);
