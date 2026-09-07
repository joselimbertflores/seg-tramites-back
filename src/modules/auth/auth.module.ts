import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { SessionGuard, PermissionGuard } from './guards';
import { UsersModule } from 'src/modules/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from '../administration/schemas';
import { AuthorizationContextService } from './services';
import { AccountGuard } from '../administration/guards/account.guard';
import { AuthHttpService } from './services/auth-http.service';
import { OAuthController } from './oauth.controller';
import { AuthSession, AuthSessionSchema } from './schemas/auth-session.schema';
import { OAuthTransaction, OAuthTransactionSchema } from './schemas/oauth-transaction.schema';
import { AuthSessionService } from './services/auth-session.service';
import { IdentityHubOAuthService } from './services/identity-hub-oauth.service';
import { OAuthTransactionService } from './services/oauth-transaction.service';
import { TokenVerifierService } from './services/token-verifier.service';

@Global()
@Module({
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    AuthorizationContextService,
    PermissionGuard,
    AccountGuard,
    AuthHttpService,
    AuthSessionService,
    IdentityHubOAuthService,
    OAuthTransactionService,
    TokenVerifierService,
    SessionGuard,
    {
      provide: APP_GUARD,
      useExisting: SessionGuard,
    },
  ],
  imports: [
    ConfigModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: OAuthTransaction.name, schema: OAuthTransactionSchema },
    ]),
  ],
  exports: [
    AuthHttpService,
    AuthSessionService,
    SessionGuard,
    AuthorizationContextService,
    PermissionGuard,
    AccountGuard,
  ],
})
export class AuthModule {}
