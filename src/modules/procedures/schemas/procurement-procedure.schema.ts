import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Account, Institution, Dependency, Officer } from 'src/modules/administration/schemas';
import { procedureGroup, procedureState, procedureStatus } from './procedure.schema';

@Schema({ _id: false })
export class ItemProcurement {
  @Prop()
  code: string;

  @Prop()
  name: string;

  @Prop()
  ff: string;

  @Prop()
  of: string;

  @Prop()
  amount: number;
}
const ItemsProcurementSchema = SchemaFactory.createForClass(ItemProcurement);

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

@Schema({ _id: false })
export class DocumentsProcurement {
  @Prop(OfficerPropsSchema)
  sender: OfficerProps;

  @Prop(OfficerPropsSchema)
  recipient: OfficerProps;

  @Prop()
  cite: string;

  @Prop()
  reference: string;

  @Prop()
  date: Date;
}
const DocumentsProcurementSchema = SchemaFactory.createForClass(DocumentsProcurement);

@Schema()
export class ProcurementProcedure {
  code: string;
  prefix: string;
  correlative: number;
  reference: string;
  cite: string;
  numberOfDocuments: string;
  account: Account;
  state: procedureState;
  group: procedureGroup;
  status: procedureStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date;
  institution: Institution;
  dependency: Dependency;
  officer: Officer;

  @Prop()
  mode: string;

  @Prop()
  aperturaProg: string;

  @Prop({ type: [ItemsProcurementSchema], default: [] })
  items: ItemProcurement[];

  @Prop()
  type: string;

  @Prop()
  descripcionAperturaProg: string;

  @Prop()
  metodoAdjudicacion: string;

  @Prop()
  formaAdjudicacion: string;

  @Prop()
  price: string;

  @Prop()
  deliveryTimeframe: string;

  @Prop()
  deliveryLocation: string;

  @Prop()
  warranty: string;

  @Prop()
  reason: string;

  @Prop({ type: [DocumentsProcurementSchema], default: [] })
  documents: DocumentsProcurement[];
}

export const ProcurementProcedureSchema = SchemaFactory.createForClass(ProcurementProcedure);
