import { ServeStaticModule } from '@nestjs/serve-static';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { join } from 'path';
import { AuthModule } from './modules/auth/auth.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { GroupwareModule } from './modules/groupware/groupware.module';
import { ProceduresModule } from './modules/procedures/procedures.module';
import { ReportsModule } from './modules/reports/reports.module';

import { FilesModule } from './modules/files/files.module';
import { PublicationsModule } from './modules/publications/publications.module';
import { UsersModule } from './modules/users/users.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { EnvVars, validate } from './config';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService<EnvVars>) => ({
        uri: configService.get('DATABASE_URL'),
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AdministrationModule,
    ProceduresModule,
    GroupwareModule,
    ReportsModule,
    FilesModule,
    PublicationsModule,
    CommunicationsModule,
    SchedulerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
