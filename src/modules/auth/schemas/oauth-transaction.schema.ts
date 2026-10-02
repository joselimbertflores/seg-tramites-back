import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'oauth_transactions' })
export class OAuthTransaction {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: String, required: true })
  stateHash: string;

  @Prop({ type: String, required: true })
  nonce: string;

  @Prop({ type: String, required: true })
  codeVerifier: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const OAuthTransactionSchema = SchemaFactory.createForClass(OAuthTransaction);
OAuthTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
