import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard, PermissionGuard } from './guards';
import { UsersModule } from 'src/modules/users/users.module';
import { EnvVars } from 'src/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from '../administration/schemas';
import { AuthorizationContextService } from './services';
import { AccountGuard } from '../administration/guards/account.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthorizationContextService,
    PermissionGuard,
    AccountGuard,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  imports: [
    ConfigModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Account.name, schema: AccountSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService<EnvVars>) => ({
        secret: configService.get('JWT_KEY'),
        signOptions: { expiresIn: '10h' },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [JwtStrategy, PassportModule, JwtModule, AuthorizationContextService, PermissionGuard, AccountGuard],
})
export class AuthModule {}
