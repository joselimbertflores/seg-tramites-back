import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { EnvVars } from 'src/config';

@Injectable()
export class IdentityHubOAuthService {
  constructor(private readonly config: ConfigService<EnvVars>) {}

  get redirectUri(): string {
    return new URL('/auth/callback', this.config.getOrThrow('SEG_TRAMITES_PUBLIC_URL')).toString();
  }

  authorizeUrl(state: string, nonce: string, codeChallenge: string): string {
    const url = new URL('/oauth/authorize', this.config.getOrThrow('IDENTITY_HUB_PUBLIC_URL'));
    url.search = new URLSearchParams({
      client_id: this.config.getOrThrow('OAUTH_CLIENT_ID'),
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<string> {
    const baseUrl = this.config.get('IDENTITY_HUB_INTERNAL_URL') || this.config.getOrThrow('IDENTITY_HUB_PUBLIC_URL');
    const credentials = [this.config.getOrThrow('OAUTH_CLIENT_ID'), this.config.getOrThrow('OAUTH_CLIENT_SECRET')]
      .map((value) => new URLSearchParams({ value }).toString().slice('value='.length))
      .join(':');
    let data: { id_token?: unknown };
    try {
      const response = await axios.post<{ id_token?: unknown }>(
        new URL('/oauth/token', baseUrl).toString(),
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          redirect_uri: this.redirectUri,
        }).toString(),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10_000,
          maxRedirects: 0,
        },
      );
      data = response.data;
    } catch (error) {
      if (
        !isAxiosError(error) ||
        !error.response ||
        error.response.status >= 500 ||
        [408, 429].includes(error.response.status)
      ) {
        throw new ServiceUnavailableException('Identity Hub no está disponible temporalmente. Intente nuevamente.');
      }
      throw new BadGatewayException('Identity Hub rechazó el canje del código de autorización');
    }
    if (typeof data?.id_token !== 'string' || !data.id_token.trim()) {
      throw new BadGatewayException('Respuesta OIDC inválida de Identity Hub');
    }
    return data.id_token;
  }

  async logoutSession(sid: string): Promise<void> {
    const baseUrl = this.config.get('IDENTITY_HUB_INTERNAL_URL') || this.config.getOrThrow('IDENTITY_HUB_PUBLIC_URL');
    await axios.post(
      new URL('/internal/sessions/logout', baseUrl).toString(),
      { sid },
      {
        auth: {
          username: this.config.getOrThrow('OAUTH_CLIENT_ID'),
          password: this.config.getOrThrow('OAUTH_CLIENT_SECRET'),
        },
        timeout: 10_000,
        maxRedirects: 0,
      },
    );
  }
}
