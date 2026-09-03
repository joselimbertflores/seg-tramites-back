import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Module } from '@nestjs/common';

import { AdministrationModule } from './modules/administration/administration.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { PublicationsModule } from './modules/publications/publications.module';
import { ProceduresModule } from './modules/procedures/procedures.module';
import { GroupwareModule } from './modules/groupware/groupware.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import { AuthModule } from './modules/auth/auth.module';

import { EnvVars, validationSchema } from './config';
import { ResourcesModule } from './modules/resources/resources.module';
import { PrinterModule } from './modules/printer/printer.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService<EnvVars>) => ({
        uri: configService.get('DATABASE_URL'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    AdministrationModule,
    CommunicationsModule,
    PublicationsModule,
    NotificationsModule,
    ProceduresModule,
    SchedulerModule,
    ResourcesModule,
    GroupwareModule,
    ReportsModule,
    PrinterModule,
    UsersModule,
    FilesModule,
    ChatModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
