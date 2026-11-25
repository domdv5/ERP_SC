import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  Post,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { AppModule } from '@/app.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { THROTTLER_OPTIONS, UserThrottlerGuard } from './user-throttler.guard';

// Simula al JwtAuthGuard: el usuario logueado llega en un header de prueba
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const sub = req.headers['x-test-user'];
    if (sub) req.user = { sub };
    return true;
  }
}

@Controller('test')
class TestController {
  @Get('default')
  byDefault() {
    return 'ok';
  }

  @Get('strict')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  strict() {
    return 'ok';
  }

  @Post('public')
  publicRoute(@Body() _body: unknown) {
    return 'ok';
  }
}

async function buildApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot(THROTTLER_OPTIONS)],
    controllers: [TestController, AuthController],
    providers: [
      { provide: AuthService, useValue: { login: jest.fn(async () => ({})) } },
      { provide: APP_GUARD, useClass: FakeAuthGuard },
      { provide: APP_GUARD, useClass: UserThrottlerGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  // Como en producción detrás del balanceador: permite simular la IP del cliente
  app.set('trust proxy', 1);
  await app.init();
  return app;
}

async function hit(times: number, send: () => request.Test) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i++) statuses.push((await send()).status);
  return statuses;
}

describe('AppModule', () => {
  it('registra UserThrottlerGuard como último APP_GUARD, después de JwtAuthGuard', () => {
    const providers: { provide?: unknown; useClass?: unknown }[] =
      Reflect.getMetadata('providers', AppModule);
    const guards = providers
      .filter((p) => p.provide === APP_GUARD)
      .map((p) => p.useClass);

    expect(guards.at(-1)).toBe(UserThrottlerGuard);
    expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(
      guards.indexOf(UserThrottlerGuard),
    );
  });
});

describe('UserThrottlerGuard', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (username: unknown) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'x' });

  it('login: frena el 6.º intento del mismo usuario y deja entrar a otro desde la misma IP', async () => {
    expect(await hit(5, () => login('ana'))).toEqual([201, 201, 201, 201, 201]);

    const blocked = await login('ana');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(THROTTLER_OPTIONS.errorMessage);

    expect((await login('luis')).status).toBe(201);
  });

  it('login: "Ana" y "ana" comparten el mismo contador', async () => {
    await hit(5, () => login('ana'));
    expect((await login(' ANA ')).status).toBe(429);
  });

  it('login: una IP no puede barrer más de 30 cuentas distintas por minuto', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++)
      statuses.push((await login(`user${i}`)).status);

    expect(statuses.slice(0, 30).every((s) => s === 201)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('login: IPv6 de la misma subred /64 comparten el contador por IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', `2001:db8:0:1::${(i + 1).toString(16)}`)
        .send({ username: `user${i}`, password: 'x' });
      statuses.push(res.status);
    }

    expect(statuses[30]).toBe(429);
  });

  it('el contador por IP del login no se aplica a otros endpoints', async () => {
    const byDefault = (sub: string) =>
      request(app.getHttpServer()).get('/test/default').set('x-test-user', sub);

    for (let i = 0; i < 31; i++) {
      expect((await byDefault(`user${i}`)).status).toBe(200);
    }
  });

  it('login: un usuario que no es texto no rompe el guard', async () => {
    expect((await login({ $ne: 1 })).status).toBe(201);
  });

  it('logueados: cada persona tiene su propio cupo aunque compartan IP', async () => {
    const strict = (sub: string) =>
      request(app.getHttpServer()).get('/test/strict').set('x-test-user', sub);

    expect(await hit(3, () => strict('ana'))).toEqual([200, 200, 429]);
    expect((await strict('luis')).status).toBe(200);
  });

  it('endpoint sin decorador: usa el tope general de 300 por minuto', async () => {
    const byDefault = () =>
      request(app.getHttpServer())
        .get('/test/default')
        .set('x-test-user', 'ana');

    const statuses = await hit(301, byDefault);
    expect(statuses.slice(0, 300).every((s) => s === 200)).toBe(true);
    expect(statuses[300]).toBe(429);
  });
});
