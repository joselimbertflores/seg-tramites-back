import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongoSchema, Types } from 'mongoose';

export type AuthMethod = 'LOCAL' | 'IDENTITY_HUB';
export type AuthSessionDocument = HydratedDocument<AuthSession>;

@Schema({ collection: 'auth_sessions', timestamps: true })
export class AuthSession {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: MongoSchema.Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: ['LOCAL', 'IDENTITY_HUB'], required: true })
  authMethod: AuthMethod;

  @Prop({
    type: String,
    required: function (this: AuthSession) {
      return this.authMethod === 'IDENTITY_HUB';
    },
    validate: function (this: AuthSession, value?: string) {
      return this.authMethod === 'IDENTITY_HUB' ? !!value?.trim() : value == null;
    },
  })
  identitySid?: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: String, select: false })
  accessToken?: string;

  @Prop({ type: String, select: false })
  refreshToken?: string;

  @Prop({ type: Date })
  accessTokenExpiresAt?: Date;

  @Prop({ type: Date })
  refreshTokenExpiresAt?: Date;

  @Prop({ type: String, select: false })
  refreshLock?: string;

  @Prop({ type: Date, select: false })
  refreshLockUntil?: Date;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthSessionSchema.index({ authMethod: 1, identitySid: 1 });
