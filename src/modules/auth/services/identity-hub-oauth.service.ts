import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { EnvVars } from 'src/config';

export interface IdentityHubTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token_expires_in: number;
}

export class IdentityHubTokenError extends BadGatewayException {
  constructor(readonly oauthError: string) {
    super('Identity Hub rechazó la solicitud de tokens');
  }
}

@Injectable()
export class IdentityHubOAuthService {
  constructor(private readonly config: ConfigService<EnvVars>) {}

  get redirectUri(): string {
    return new URL('/auth/callback', this.config.getOrThrow('SEG_TRAMITES_PUBLIC_URL')).toString();
  }

  authorizeUrl(state: string, codeChallenge: string): string {
    const url = new URL('/oauth/authorize', this.config.getOrThrow('IDENTITY_HUB_PUBLIC_URL'));
    url.search = new URLSearchParams({
      client_id: this.config.getOrThrow('OAUTH_CLIENT_ID'),
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  exchangeCode(code: string, codeVerifier: string): Promise<IdentityHubTokens> {
    return this.requestTokens({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.redirectUri,
    });
  }

  refresh(refreshToken: string): Promise<IdentityHubTokens> {
    return this.requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
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

  private async requestTokens(payload: Record<string, string>): Promise<IdentityHubTokens> {
    const baseUrl = this.config.get('IDENTITY_HUB_INTERNAL_URL') || this.config.getOrThrow('IDENTITY_HUB_PUBLIC_URL');
    const credentials = [this.config.getOrThrow('OAUTH_CLIENT_ID'), this.config.getOrThrow('OAUTH_CLIENT_SECRET')]
      .map((value) => new URLSearchParams({ value }).toString().slice('value='.length))
      .join(':');
    let tokens: IdentityHubTokens;
    try {
      const response = await axios.post<IdentityHubTokens>(
        new URL('/oauth/token', baseUrl).toString(),
        new URLSearchParams(payload).toString(),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10_000,
          maxRedirects: 0,
        },
      );
      tokens = response.data;
    } catch (error) {
      if (
        !isAxiosError(error) ||
        !error.response ||
        error.response.status >= 500 ||
        [408, 429].includes(error.response.status)
      ) {
        throw new ServiceUnavailableException('Identity Hub no está disponible temporalmente. Intente nuevamente.');
      }
      if (typeof error.response.data?.error === 'string') {
        throw new IdentityHubTokenError(error.response.data.error);
      }
      throw new BadGatewayException('Respuesta de tokens inválida de Identity Hub');
    }
    if (
      typeof tokens?.access_token !== 'string' ||
      !tokens.access_token ||
      typeof tokens.refresh_token !== 'string' ||
      !tokens.refresh_token ||
      tokens.token_type !== 'Bearer' ||
      !Number.isSafeInteger(tokens.expires_in) ||
      tokens.expires_in <= 0 ||
      !Number.isSafeInteger(tokens.refresh_token_expires_in) ||
      tokens.refresh_token_expires_in <= 0
    ) {
      throw new BadGatewayException('Respuesta de tokens inválida de Identity Hub');
    }
    return tokens;
  }
}
