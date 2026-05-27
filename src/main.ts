import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter';
import { ResponseFormatInterceptor } from '@/common/interceptors/response-format.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalInterceptors(new ResponseFormatInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
