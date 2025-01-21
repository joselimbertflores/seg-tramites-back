import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, HydratedDocument } from 'mongoose';
import { Role, User } from 'src/modules/users/schemas';
import { Institution } from './institution.schema';
import { Dependency } from './dependencie.schema';
import { Officer } from './officer.schema';

export type AccountDocument = HydratedDocument<Account>;
@Schema({ collection: 'cuentas' })
export class Account extends Document {
  // @Prop({
  //   type: String,
  // })
  // login: string;

  // @Prop({
  //   type: String,
  // })
  // password: string;

  // @Prop({
  //   type: Boolean,
  //   default: true,
  // })
  // activo: boolean;

  @Prop({
    type: Boolean,
    default: true,
  })
  isVisible: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  updatedPassword: boolean;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Dependency.name,
  })
  dependencia: Dependency;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Institution.name,
  })
  institution: Institution;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Officer.name,
  })
  officer?: Officer;

  @Prop({ type: String })
  jobtitle: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Role.name,
  })
  rol: Role;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  user: User;

  @Prop()
  area?: number;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
