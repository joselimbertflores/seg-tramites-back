import { model, Types } from 'mongoose';
import { AuthSession, AuthSessionSchema } from './auth-session.schema';

const SessionModel = model(AuthSession.name, AuthSessionSchema);
const fields = { user: new Types.ObjectId(), expiresAt: new Date(Date.now() + 60_000) };

describe('AuthSession', () => {
  it('allows LOCAL without identitySid and requires it for IDENTITY_HUB', () => {
    expect(new SessionModel({ ...fields, authMethod: 'LOCAL' }).validateSync()).toBeUndefined();
    expect(
      new SessionModel({ ...fields, authMethod: 'LOCAL', identitySid: 'siau-session' }).validateSync(),
    ).toBeDefined();
    expect(new SessionModel({ ...fields, authMethod: 'IDENTITY_HUB' }).validateSync()).toBeDefined();
    expect(
      new SessionModel({ ...fields, authMethod: 'IDENTITY_HUB', identitySid: 'siau-session' }).validateSync(),
    ).toBeUndefined();
  });
});
