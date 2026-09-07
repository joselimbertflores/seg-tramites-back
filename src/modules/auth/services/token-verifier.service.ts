import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient, SigningKeyNotFoundError } from 'jwks-rsa';
import { EnvVars } from 'src/config';

export interface IdentityHubClaims extends jwt.JwtPayload {
  sub: string;
  externalKey: string;
  exp: number;
}

export class InvalidIdentityTokenError extends UnauthorizedException {
  constructor(readonly expired = false) {
    super('Token de Identity Hub inválido');
  }
}

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

  async verify(token: string): Promise<IdentityHubClaims> {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded?.header?.alg !== 'RS256' || typeof decoded.header.kid !== 'string' || !decoded.header.kid) {
      throw new InvalidIdentityTokenError();
    }
    let publicKey: string;
    try {
      publicKey = (await this.jwks.getSigningKey(decoded.header.kid)).getPublicKey();
    } catch (error) {
      if (error instanceof SigningKeyNotFoundError) throw new InvalidIdentityTokenError();
      throw new ServiceUnavailableException('No fue posible verificar Identity Hub temporalmente. Intente nuevamente.');
    }
    try {
      const claims = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.getOrThrow('IDENTITY_HUB_PUBLIC_URL'),
        audience: this.config.getOrThrow('OAUTH_CLIENT_ID'),
      });
      if (
        typeof claims === 'string' ||
        typeof claims.sub !== 'string' ||
        !claims.sub.trim() ||
        typeof claims.externalKey !== 'string' ||
        !claims.externalKey.trim() ||
        typeof claims.exp !== 'number' ||
        !Number.isFinite(claims.exp)
      )
        throw new InvalidIdentityTokenError();
      return claims as IdentityHubClaims;
    } catch (error) {
      throw new InvalidIdentityTokenError(error instanceof jwt.TokenExpiredError);
    }
  }
}
