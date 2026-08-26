import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from 'src/modules/users/schemas';
import { Institution } from './institution.schema';
import { Dependency } from './dependencie.schema';
import { Officer } from './officer.schema';
import { Role } from 'src/modules/users/schemas';

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
    default: null,
  })
  officer: Officer | null;

  @Prop({ type: String, uppercase: true })
  jobtitle: string;

  @Prop({
    type: String,
  })
  employmentType?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    default: null,
  })
  user: User | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Role.name,
    required: true,
  })
  role: Role;

  @Prop({ type: Number })
  area?: number;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

AccountSchema.pre('validate', function (next) {
  if (Boolean(this.user) !== Boolean(this.officer)) {
    return next(new Error('Account user and officer must both be assigned or both be null'));
  }
  next();
});

AccountSchema.index(
  { officer: 1 },
  {
    unique: true,
    partialFilterExpression: { officer: { $type: 'objectId' } },
  },
);

AccountSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: 'objectId' } },
  },
);
