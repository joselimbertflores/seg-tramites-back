import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Institution } from './institution.schema';

@Schema({ _id: false })
class Area {
  @Prop()
  name: string;

  @Prop()
  code: number;
}
const AreaSchema = SchemaFactory.createForClass(Area);

@Schema({ collection: 'dependencias' })
export class Dependency extends Document {
  @Prop({
    type: String,
    required: true,
    uppercase: true,
  })
  nombre: string;

  @Prop({
    type: String,
  })
  codigo: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Institution.name,
  })
  institucion: Institution;

  @Prop({
    type: [AreaSchema],
    default: [],
    validate: {
      validator: function (areas: Area[]) {
        const codes = areas.map((area) => area.code);
        return new Set(codes).size === codes.length;
      },
      message: 'Duplicate area codes are not allowed',
    },
  })
  areas: Area[];

  @Prop({
    type: Boolean,
    default: true,
  })
  activo: boolean;
}

export const DependencySchema = SchemaFactory.createForClass(Dependency);
