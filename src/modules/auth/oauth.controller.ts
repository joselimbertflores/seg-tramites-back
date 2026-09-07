import { Controller, Get, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Request, Response } from 'express';
import { Model } from 'mongoose';
import { User } from '../users/schemas';
import { AuthHttpService, OAUTH_TRANSACTION_COOKIE_NAME } from './services/auth-http.service';
import { Public } from './decorators/public.decorator';
import { AuthSessionService } from './services/auth-session.service';
import { IdentityHubOAuthService, IdentityHubTokens } from './services/identity-hub-oauth.service';
import { OAuthTransactionService } from './services/oauth-transaction.service';
import { TokenVerifierService } from './services/token-verifier.service';

@Controller('auth')
@Public()
export class OAuthController {
  constructor(
    private readonly authHttp: AuthHttpService,
    private readonly transactions: OAuthTransactionService,
    private readonly identityHub: IdentityHubOAuthService,
    private readonly verifier: TokenVerifierService,
    private readonly sessions: AuthSessionService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  @Get('login')
  async login(@Req() request: Request, @Res() response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    try {
      await this.transactions.discard(this.authHttp.read(request.headers.cookie, OAUTH_TRANSACTION_COOKIE_NAME));
      const { transactionId, state, codeChallenge, expiresAt } = await this.transactions.create();
      const url = this.identityHub.authorizeUrl(state, codeChallenge);
      this.authHttp.setTransaction(response, transactionId, expiresAt);
      return response.redirect(url);
    } catch {
      return this.redirectError(response, 'authorization_failed');
    }
  }

  @Get('callback')
  async callback(@Req() request: Request, @Res() response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const transactionId = this.authHttp.read(request.headers.cookie, OAUTH_TRANSACTION_COOKIE_NAME);
    const { state, code, error } = request.query;
    this.authHttp.clearTransaction(response);
    try {
      if (!transactionId || typeof state !== 'string' || !state || state.length > 512) {
        await this.transactions.discard(transactionId);
        return this.redirectError(response, 'invalid_state');
      }
      const codeVerifier = await this.transactions.consume(transactionId, state);
      if (!codeVerifier) return this.redirectError(response, 'invalid_state');
      if (error !== undefined)
        return this.redirectError(response, error === 'access_denied' ? 'access_denied' : 'authorization_failed');
      if (typeof code !== 'string' || !code || code.length > 4096) return this.redirectError(response, 'missing_code');

      let tokens: IdentityHubTokens;
      try {
        tokens = await this.identityHub.exchangeCode(code, codeVerifier);
      } catch (error) {
        return this.redirectError(
          response,
          error instanceof ServiceUnavailableException ? 'identity_hub_unavailable' : 'token_exchange_failed',
        );
      }

      const claims = await this.verifier.verify(tokens.access_token);
      const user = await this.users.findOne({ externalKey: claims.externalKey });
      if (!user) return this.redirectError(response, 'not_provisioned');

      const session = await this.sessions.createIdentityHub(user, tokens, claims);
      try {
        await this.sessions.delete(this.authHttp.read(request.headers.cookie));
        this.authHttp.setSession(response, session._id, session.expiresAt);
        return response.redirect(this.authHttp.frontendUrl('/home'));
      } catch (error) {
        await this.sessions.delete(session._id);
        throw error;
      }
    } catch {
      return this.redirectError(response, 'authentication_failed');
    }
  }

  private redirectError(response: Response, error: string) {
    this.authHttp.clearTransaction(response);
    return response.redirect(this.authHttp.frontendUrl('/login', error));
  }
}
