import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse } from 'cookie';
import { CookieOptions, Request, Response } from 'express';
import { EnvVars } from 'src/config';

export const SESSION_COOKIE_NAME = 'seg_tramites_session';
export const OAUTH_TRANSACTION_COOKIE_NAME = 'seg_tramites_oauth_transaction';

@Injectable()
export class AuthHttpService {
  readonly publicOrigin: string;
  readonly uiOrigin?: string;
  readonly trustedOrigins: string[];

  constructor(private readonly config: ConfigService<EnvVars>) {
    this.publicOrigin = new URL(config.getOrThrow('SEG_TRAMITES_PUBLIC_URL')).origin;
    const uiUrl = config.get('SEG_TRAMITES_UI_URL');
    this.uiOrigin = uiUrl ? new URL(uiUrl).origin : undefined;
    this.trustedOrigins = [...new Set([this.publicOrigin, ...(this.uiOrigin ? [this.uiOrigin] : [])])];
  }

  read(header: string | undefined, name = SESSION_COOKIE_NAME): string | undefined {
    const value = parse(header ?? '')[name];
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
  }

  private options(path = '/', transaction = false): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow('AUTH_COOKIE_SECURE'),
      // The OAuth callback is a top-level navigation from another site.
      sameSite: transaction ? 'lax' : this.config.getOrThrow('AUTH_COOKIE_SAME_SITE'),
      path,
    };
  }

  setSession(response: Response, id: string, expires: Date): void {
    response.cookie(SESSION_COOKIE_NAME, id, { ...this.options(), expires });
  }

  clearSession(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, this.options());
  }

  setTransaction(response: Response, id: string, expires: Date): void {
    response.cookie(OAUTH_TRANSACTION_COOKIE_NAME, id, { ...this.options('/auth', true), expires });
  }

  clearTransaction(response: Response): void {
    // LOCAL endpoints cannot read Path=/auth cookies; pending Mongo transactions are left to TTL cleanup.
    response.clearCookie(OAUTH_TRANSACTION_COOKIE_NAME, this.options('/auth', true));
  }

  assertRequestOrigin(request: Request): void {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (
      (origin && !this.trustedOrigins.includes(origin)) ||
      (!origin && request.headers['sec-fetch-site'] === 'cross-site')
    ) {
      throw new ForbiddenException('Origen de solicitud no permitido');
    }
  }

  frontendUrl(path: string, error?: string): string {
    const url = new URL(
      path,
      this.config.get('SEG_TRAMITES_UI_URL') || this.config.getOrThrow('SEG_TRAMITES_PUBLIC_URL'),
    );
    if (error) url.searchParams.set('error', error);
    return url.toString();
  }
}
