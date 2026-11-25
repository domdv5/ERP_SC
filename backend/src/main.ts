import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter';
import { ResponseFormatInterceptor } from '@/common/interceptors/response-format.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Cantidad de proxies delante del backend (1 = balanceador de DO); en 0 nadie puede falsificar su IP con X-Forwarded-For
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(proxyHops) && proxyHops > 0) {
    app.set('trust proxy', proxyHops);
  }
  // El frontend vive en otro origen y carga PDFs del backend; same-origin bloquearía esas descargas.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalInterceptors(new ResponseFormatInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
