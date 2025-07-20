import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Role } from './role.schema';

@Schema()
export class User extends Document {
  @Prop({
    type: String,
    required: true,
  })
  fullname: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  login: string;

  @Prop({
    type: String,
    required: true,
  })
  password: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Role.name,
  })
  role: Role;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  updatedPassword: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
