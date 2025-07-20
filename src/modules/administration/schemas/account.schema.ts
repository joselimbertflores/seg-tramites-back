import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from 'src/modules/users/schemas';
import { Institution } from './institution.schema';
import { Dependency } from './dependencie.schema';
import { Officer } from './officer.schema';

@Schema({ collection: 'cuentas' })
export class Account extends Document {
  @Prop({
    type: Boolean,
    default: true,
  })
  isVisible: boolean;

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
  officer: Officer | null;

  @Prop({ type: String, uppercase:true })
  jobtitle: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user: User;

  @Prop({ type: Number })
  area?: number;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

AccountSchema.index(
  { officer: 1 },
  {
    unique: true,
    partialFilterExpression: { officer: { $type: 'objectId' } },
  },
);
