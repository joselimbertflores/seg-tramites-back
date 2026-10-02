import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient, SigningKeyNotFoundError } from 'jwks-rsa';
import { EnvVars } from 'src/config';

export interface IdentityHubIdTokenClaims extends jwt.JwtPayload {
  sub: string;
  externalKey: string;
  name: string;
  nonce: string;
  iat: number;
  exp: number;
  sid: string;
}

const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

@Injectable()
export class TokenVerifierService {
  private readonly jwks: JwksClient;

  constructor(private readonly config: ConfigService<EnvVars>) {
    this.jwks = new JwksClient({
      jwksUri: new URL(
        '/.well-known/jwks.json',
        config.get('IDENTITY_HUB_INTERNAL_URL') || config.getOrThrow('IDENTITY_HUB_PUBLIC_URL'),
      ).toString(),
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      timeout: 10_000,
    });
  }

  async verifyIdToken(token: string, nonce: string): Promise<IdentityHubIdTokenClaims> {
    const claims = await this.verifyJwt(token);
    if (
      typeof claims.sub !== 'string' ||
      !claims.sub.trim() ||
      typeof claims.externalKey !== 'string' ||
      !claims.externalKey.trim() ||
      typeof claims.name !== 'string' ||
      !claims.name.trim() ||
      typeof claims.nonce !== 'string' ||
      claims.nonce !== nonce ||
      typeof claims.sid !== 'string' ||
      !claims.sid.trim()
    )
      throw new UnauthorizedException('ID Token de Identity Hub inválido');
    return claims as IdentityHubIdTokenClaims;
  }

  async verifyLogoutToken(token: string): Promise<string> {
    const claims = await this.verifyJwt(token, 'logout+jwt');
    const events = claims.events;
    if (
      typeof claims.jti !== 'string' ||
      !claims.jti.trim() ||
      typeof claims.sid !== 'string' ||
      !claims.sid.trim() ||
      !events ||
      typeof events !== 'object' ||
      Array.isArray(events) ||
      !Object.prototype.hasOwnProperty.call(events, BACKCHANNEL_LOGOUT_EVENT) ||
      !events[BACKCHANNEL_LOGOUT_EVENT] ||
      typeof events[BACKCHANNEL_LOGOUT_EVENT] !== 'object' ||
      Array.isArray(events[BACKCHANNEL_LOGOUT_EVENT]) ||
      Object.prototype.hasOwnProperty.call(claims, 'nonce')
    )
      throw new UnauthorizedException('Logout Token de Identity Hub inválido');
    return claims.sid;
  }

  private async verifyJwt(token: string, typ?: string): Promise<jwt.JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (
      decoded?.header?.alg !== 'RS256' ||
      typeof decoded.header.kid !== 'string' ||
      !decoded.header.kid.trim() ||
      (typ && decoded.header.typ !== typ)
    ) {
      throw new UnauthorizedException('Token de Identity Hub inválido');
    }
    let publicKey: string;
    try {
      publicKey = (await this.jwks.getSigningKey(decoded.header.kid)).getPublicKey();
    } catch (error) {
      if (error instanceof SigningKeyNotFoundError) throw new UnauthorizedException('Token de Identity Hub inválido');
      throw new ServiceUnavailableException('No fue posible verificar Identity Hub temporalmente. Intente nuevamente.');
    }
    let claims: jwt.JwtPayload | string;
    try {
      claims = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.getOrThrow('IDENTITY_HUB_PUBLIC_URL'),
        audience: this.config.getOrThrow('OAUTH_CLIENT_ID'),
      });
    } catch {
      throw new UnauthorizedException('Token de Identity Hub inválido');
    }
    if (
      typeof claims === 'string' ||
      claims.aud !== this.config.getOrThrow('OAUTH_CLIENT_ID') ||
      !Number.isSafeInteger(claims.iat) ||
      claims.iat <= 0 ||
      claims.iat > Math.floor(Date.now() / 1000) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= claims.iat
    ) {
      throw new UnauthorizedException('Token de Identity Hub inválido');
    }
    return claims;
  }
}
