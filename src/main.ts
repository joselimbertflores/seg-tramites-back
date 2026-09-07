import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AuthHttpService } from './modules/auth/services/auth-http.service';
import { AuthSessionService } from './modules/auth/services/auth-session.service';
import { SessionIoAdapter } from './modules/auth/session-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'auth/login', method: RequestMethod.GET },
      { path: 'auth/callback', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  const authHttp = app.get(AuthHttpService);
  if (authHttp.uiOrigin) {
    app.enableCors({ origin: authHttp.uiOrigin, credentials: true });
  }
  app.useWebSocketAdapter(new SessionIoAdapter(app, app.get(AuthSessionService), authHttp));
  await app.listen(process.env.PORT);
}
bootstrap();
