import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { Account, Dependency } from 'src/modules/administration/schemas';

export enum docType {
  CI = 'CI',
  CE = 'CE',
  CIR = 'CIR',
  MEM = 'MEM',
}

@Schema({ _id: false })
class ProcedureProps {
  @Prop()
  code: string;

  @Prop()
  group: string;
}
const ProcedurePropsSchema = SchemaFactory.createForClass(ProcedureProps);

@Schema({ _id: false })
class OfficerProps {
  @Prop({
    type: String,
    uppercase: true,
  })
  fullname: string;

  @Prop({
    type: String,
    uppercase: true,
  })
  jobtitle: string;
}
const OfficerPropsSchema = SchemaFactory.createForClass(OfficerProps);

@Schema({ timestamps: true })
export class Doc {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
  })
  account: Account;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Dependency.name,
  })
  dependecy: Dependency;

  @Prop({ enum: docType })
  type: docType;

  @Prop()
  segment: string;

  @Prop()
  correlative: number;

  @Prop()
  cite: string;

  @Prop()
  reference: string;

  @Prop(ProcedurePropsSchema)
  procedure: ProcedureProps;

  @Prop(OfficerPropsSchema)
  sender: OfficerProps;

  @Prop(OfficerPropsSchema)
  recipient: OfficerProps;

  @Prop(OfficerPropsSchema)
  via?: OfficerProps;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}
export const DocSchema = SchemaFactory.createForClass(Doc);

type DocDocumentOverride = {
  sender: Types.Subdocument<Types.ObjectId & OfficerProps>;
  recipient: Types.Subdocument<Types.ObjectId & OfficerProps>;
  via?: Types.Subdocument<Types.ObjectId & OfficerProps>;
};

export type DocDocument = HydratedDocument<Doc, DocDocumentOverride>;
