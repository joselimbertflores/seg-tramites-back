import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { Model } from 'mongoose';
import { User } from 'src/modules/users/schemas';
import { AuthSession, AuthSessionDocument } from '../schemas/auth-session.schema';
import { IdentityHubOAuthService, IdentityHubTokenError, IdentityHubTokens } from './identity-hub-oauth.service';
import { IdentityHubClaims, InvalidIdentityTokenError, TokenVerifierService } from './token-verifier.service';

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
    private readonly identityHub: IdentityHubOAuthService,
    private readonly verifier: TokenVerifierService,
  ) {}

  createLocal(user: User): Promise<AuthSessionDocument> {
    return this.sessions.create({
      _id: randomBytes(32).toString('base64url'),
      user: user._id,
      authMethod: 'LOCAL',
      expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
    });
  }

  createIdentityHub(user: User, tokens: IdentityHubTokens, claims: IdentityHubClaims): Promise<AuthSessionDocument> {
    const fields = this.tokenFields(tokens);
    fields.accessTokenExpiresAt = new Date(Math.min(fields.accessTokenExpiresAt.getTime(), claims.exp * 1000));
    return this.sessions.create({
      _id: randomBytes(32).toString('base64url'),
      user: user._id,
      authMethod: 'IDENTITY_HUB',
      ...fields,
      // An absolute lifetime also works when tokens rotate over WebSocket, which cannot renew cookies.
      expiresAt: fields.refreshTokenExpiresAt,
    });
  }

  async resolve(id?: string): Promise<AuthenticatedSession> {
    if (!id) throw new UnauthorizedException('Debe iniciar sesión');
    let session = await this.findActive(id);
    const user = await this.users.findById(session.user).select('-password').populate('roles');
    // Identity Hub controls institutional access; local isActive only governs LOCAL authentication.
    if (!user || (session.authMethod === 'LOCAL' && !user.isActive)) return this.reject(id);

    if (session.authMethod === 'IDENTITY_HUB') {
      try {
        if (
          !session.accessToken ||
          !session.refreshToken ||
          !session.accessTokenExpiresAt ||
          !session.refreshTokenExpiresAt
        ) {
          return this.reject(id);
        }
        if (session.refreshTokenExpiresAt.getTime() <= Date.now()) return this.reject(id);
        if (session.accessTokenExpiresAt.getTime() <= Date.now()) session = await this.refreshSession(session);
        let claims: IdentityHubClaims;
        try {
          claims = await this.verifier.verify(session.accessToken);
        } catch (error) {
          if (!(error instanceof InvalidIdentityTokenError) || !error.expired) throw error;
          session = await this.refreshSession(session);
          claims = await this.verifier.verify(session.accessToken);
        }
        if (claims.externalKey !== user.externalKey) return this.reject(id);
        const accessTokenExpiresAt = new Date(Math.min(session.accessTokenExpiresAt.getTime(), claims.exp * 1000));
        if (accessTokenExpiresAt.getTime() !== session.accessTokenExpiresAt.getTime()) {
          await this.sessions.updateOne(
            { _id: id, accessToken: session.accessToken },
            { $set: { accessTokenExpiresAt } },
          );
          session.accessTokenExpiresAt = accessTokenExpiresAt;
        }
      } catch (error) {
        if (error instanceof InvalidIdentityTokenError) return this.reject(id);
        throw error;
      }
    }
    if (session.expiresAt.getTime() <= Date.now()) return this.reject(id);
    return { session, user };
  }

  async delete(id?: string): Promise<void> {
    if (!id) return;
    await this.sessions.deleteOne({ _id: id });
    this.events.emit('deleted', id);
  }

  private async findActive(id: string): Promise<AuthSessionDocument> {
    const session = await this.sessions.findById(id).select('+accessToken +refreshToken');
    if (!session || session.expiresAt.getTime() <= Date.now()) return this.reject(id);
    return session;
  }

  private async refreshSession(previous: AuthSessionDocument): Promise<AuthSessionDocument> {
    const lock = randomBytes(16).toString('hex');
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const current = await this.findActive(previous._id);
      if (current.accessToken !== previous.accessToken) return current;
      if (
        !current.refreshToken ||
        !current.refreshTokenExpiresAt ||
        current.refreshTokenExpiresAt.getTime() <= Date.now()
      ) {
        return this.reject(current._id);
      }
      // MongoDB compare-and-set serializes refresh rotation across HTTP, sockets and app processes.
      // The 30s lease outlives the 10s token request timeout and allows recovery if its owner stops.
      const locked = await this.sessions
        .findOneAndUpdate(
          {
            _id: current._id,
            accessToken: previous.accessToken,
            expiresAt: { $gt: new Date() },
            $or: [{ refreshLockUntil: { $exists: false } }, { refreshLockUntil: { $lte: new Date() } }],
          },
          { $set: { refreshLock: lock, refreshLockUntil: new Date(Date.now() + 30_000) } },
          { new: true },
        )
        .select('+accessToken +refreshToken');
      if (!locked) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      try {
        const tokens = await this.identityHub.refresh(locked.refreshToken);
        // Persist the rotated pair before JWKS verification so a temporary JWKS outage cannot lose it.
        const updated = await this.sessions
          .findOneAndUpdate(
            { _id: locked._id, refreshLock: lock },
            { $set: this.tokenFields(tokens), $unset: { refreshLock: 1, refreshLockUntil: 1 } },
            { new: true },
          )
          .select('+accessToken +refreshToken');
        if (!updated) throw new UnauthorizedException('La sesión ha finalizado');
        return updated;
      } catch (error) {
        if (error instanceof IdentityHubTokenError && error.oauthError === 'invalid_grant') {
          const result = await this.sessions.deleteOne({ _id: locked._id, refreshLock: lock });
          if (result.deletedCount) this.events.emit('deleted', locked._id);
          throw new UnauthorizedException('La sesión ha expirado. Inicie sesión nuevamente');
        }
        throw error;
      } finally {
        await this.sessions.updateOne(
          { _id: locked._id, refreshLock: lock },
          { $unset: { refreshLock: 1, refreshLockUntil: 1 } },
        );
      }
    }
    throw new ServiceUnavailableException('La sesión se está renovando. Intente nuevamente');
  }

  private tokenFields(tokens: IdentityHubTokens) {
    const now = Date.now();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
      refreshTokenExpiresAt: new Date(now + tokens.refresh_token_expires_in * 1000),
    };
  }

  private async reject(id: string): Promise<never> {
    await this.delete(id);
    throw new UnauthorizedException('La sesión ha expirado o ya no es válida');
  }
}
