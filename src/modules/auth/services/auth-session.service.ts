import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { Model } from 'mongoose';
import { User } from 'src/modules/users/schemas';
import { AuthMethod, AuthSession, AuthSessionDocument } from '../schemas/auth-session.schema';

export interface AuthenticatedSession {
  session: AuthSessionDocument;
  user: User;
}

@Injectable()
export class AuthSessionService {
  readonly events = new EventEmitter();

  constructor(
    @InjectModel(AuthSession.name) private readonly sessions: Model<AuthSession>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  create(user: User, authMethod: AuthMethod, identitySid?: string): Promise<AuthSessionDocument> {
    return this.sessions.create({
      _id: randomBytes(32).toString('base64url'),
      user: user._id,
      authMethod,
      identitySid,
      expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
    });
  }

  async resolve(id?: string): Promise<AuthenticatedSession> {
    if (!id) throw new UnauthorizedException('Debe iniciar sesión');
    const session = await this.sessions.findById(id);
    if (!session || session.expiresAt.getTime() <= Date.now()) return this.reject(id);

    const user = await this.users.findById(session.user).select('-password').populate('roles');
    // Institutional revocation uses sid; isActive only governs LOCAL authentication.
    if (!user || (session.authMethod === 'LOCAL' && !user.isActive)) return this.reject(id);
    return { session, user };
  }

  async delete(id?: string): Promise<void> {
    if (!id) return;
    await this.sessions.deleteOne({ _id: id });
    this.events.emit('deleted', id);
  }

  findForLogout(id?: string): Promise<AuthSessionDocument | null> {
    if (!id) return Promise.resolve(null);
    return this.sessions.findById(id).select('authMethod identitySid').exec();
  }

  async deleteByIdentitySid(sid: string): Promise<void> {
    const filter = { authMethod: 'IDENTITY_HUB', identitySid: sid };
    const sessions = await this.sessions.find(filter).select('_id').lean();
    await this.sessions.deleteMany(filter);
    for (const session of sessions) this.events.emit('deleted', session._id);
  }

  private async reject(id: string): Promise<never> {
    await this.delete(id);
    throw new UnauthorizedException('La sesión ha expirado o ya no es válida');
  }
}
