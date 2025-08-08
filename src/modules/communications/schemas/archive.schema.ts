import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

import { Account, Dependency, Institution } from 'src/modules/administration/schemas';
import { Procedure, ProcedureDocument } from 'src/modules/procedures/schemas';
import { Communication } from './communication.schema';
import { Folder } from './folder.schema';

@Schema({ _id: false })
class OfficerProps {
  @Prop()
  fullname: string;

  @Prop()
  jobtitle: string;
}
const OfficerPropsSchema = SchemaFactory.createForClass(OfficerProps);

@Schema({ _id: false })
class ProcedureProps {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Procedure.name,
  })
  ref: ProcedureDocument;

  @Prop()
  code: string;

  @Prop()
  group: string;

  @Prop()
  reference: string;
}

const ProcedurePropsSchema = SchemaFactory.createForClass(ProcedureProps);

@Schema({ timestamps: true })
export class Archive {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
    required: true,
  })
  account: Account;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Institution.name,
    required: true,
  })
  institution: Institution;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Dependency.name,
    required: true,
  })
  dependency: Dependency;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Communication.name,
    required: true,
    unique: true,
  })
  communication: Communication;

  @Prop({ type: OfficerPropsSchema })
  officer: OfficerProps;

  @Prop({ type: ProcedurePropsSchema, required: true })
  procedure: ProcedureProps;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Folder.name,
  })
  folder: Folder | null;

  @Prop()
  description: string;

  @Prop()
  isOriginal: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  // TODO state procedure enum
  @Prop({ required: true })
  state: string;
}

export const ArchiveSchema = SchemaFactory.createForClass(Archive);

export type ArchiveDocument = HydratedDocument<Archive>;

ArchiveSchema.index({ dependency: 1, createdAt: -1 });
ArchiveSchema.index({ dependency: 1, 'procedure.code': 1 });
ArchiveSchema.index({ dependency: 1, 'procedure.reference': 1 });
ArchiveSchema.index({ dependency: 1, folder: 1, 'procedure.code': 1 });
ArchiveSchema.index({ dependency: 1, folder: 1, 'procedure.reference': 1 });