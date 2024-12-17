import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Account } from 'src/modules/administration/schemas';


@Schema()
export class Observation extends Document {
  // @Prop({
  //   type: mongoose.Schema.Types.ObjectId,
  //   refPath: Procedure.name,
  //   required: true,
  // })
  // procedure: Procedure;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
    required: true,
  })
  account: Account;

  @Prop({
    type: String,
    required: true,
  })
  fullnameOfficer: string;

  @Prop({
    type: String,
    required: true,
  })
  description: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  isSolved: boolean;

  @Prop({
    type: Date,
    default: Date.now,
  })
  date: Date;
}

export const ObservationSchema = SchemaFactory.createForClass(Observation);
