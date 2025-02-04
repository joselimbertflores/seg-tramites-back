import { ServeStaticModule } from '@nestjs/serve-static';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { join } from 'path';
import { AuthModule } from './modules/auth/auth.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { GroupwareModule } from './modules/groupware/groupware.module';
import { ProceduresModule } from './modules/procedures/procedures.module';
import { EnvConfiguration } from './config/env.configuration';
import { ReportsModule } from './modules/reports/reports.module';

import { FilesModule } from './modules/files/files.module';
import { PublicationsModule } from './modules/publications/publications.module';
import { UsersModule } from './modules/users/users.module';
import { CommunicationsModule } from './modules/communications/communications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [EnvConfiguration],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URL,
      }),
    }),
    // ServeStaticModule.forRoot({
    //   rootPath: join(__dirname, '..', 'public'),
    // }),
    AuthModule,
    UsersModule,
    AdministrationModule,
    ProceduresModule,
    GroupwareModule,
    ReportsModule,
    FilesModule,
    PublicationsModule,
    CommunicationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
