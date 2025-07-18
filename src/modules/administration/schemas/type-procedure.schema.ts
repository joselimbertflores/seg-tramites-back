import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class Requirement extends Document {
  @Prop({
    type: String,
    required: true,
  })
  nombre: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  activo: boolean;
}
const RequirementSchema = SchemaFactory.createForClass(Requirement);

@Schema({ collection: 'tipos_tramites' })
export class TypeProcedure extends Document {
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
  })
  segmento: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  activo: boolean;

  @Prop({ type: [RequirementSchema], default: [] })
  requerimientos: Requirement[];
}
export const TypeProcedureSchema = SchemaFactory.createForClass(TypeProcedure);

TypeProcedureSchema.pre<TypeProcedure>('save', function (next) {
  this.segmento = this.segmento.trim().replace(/\s/g, '').toUpperCase();
  next();
});
