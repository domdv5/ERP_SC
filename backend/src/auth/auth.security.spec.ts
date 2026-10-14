import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { LoginAuthDto } from './dto/login-auth-dto';

const INACTIVE_MESSAGE =
  'Tu usuario está desactivado. Pide al administrador que lo active.';
const SESSION_ENDED_MESSAGE =
  'Tu sesión ya no es válida. Inicia sesión de nuevo.';

describe('AuthService.login: usuarios desactivados', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
  );
  const makeUser = (active: boolean) => ({
    id: 'u1',
    name: 'Ana',
    username: 'ana',
    password: bcrypt.hashSync('secreta1', 4),
    active,
    userRoles: [],
  });

  beforeEach(() => jest.clearAllMocks());

  it('rechaza a un usuario desactivado aunque la contraseña sea correcta y no emite token', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser(false));

    await expect(
      service.login({ username: 'ana', password: 'secreta1' }),
    ).rejects.toThrow(new UnauthorizedException(INACTIVE_MESSAGE));
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('a un usuario desactivado con contraseña incorrecta le responde lo mismo que a cualquiera', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser(false));

    await expect(
      service.login({ username: 'ana', password: 'otra' }),
    ).rejects.toThrow(new UnauthorizedException('Credenciales inválidas'));
  });

  it('un usuario activo sigue entrando como siempre', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser(true));

    await expect(
      service.login({ username: 'ana', password: 'secreta1' }),
    ).resolves.toEqual({ access_token: 'token' });
  });
});

describe('JwtAuthGuard: el usuario debe seguir activo en cada pedido', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const jwtService = { verify: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const guard = new JwtAuthGuard(
    jwtService as unknown as JwtService,
    reflector as unknown as Reflector,
    prisma as unknown as PrismaService,
  );
  const request = { headers: { authorization: 'Bearer abc' } } as {
    headers: { authorization: string };
    user?: unknown;
  };
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    delete request.user;
    jwtService.verify.mockReturnValue({ sub: 'u1', permissions: [] });
  });

  it('deja pasar a un usuario activo y carga el usuario del token', async () => {
    prisma.user.findUnique.mockResolvedValue({ active: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'u1', permissions: [] });
  });

  it('corta con 401 a un usuario desactivado aunque su token siga vigente', async () => {
    prisma.user.findUnique.mockResolvedValue({ active: false });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException(SESSION_ENDED_MESSAGE),
    );
    expect(request.user).toBeUndefined();
  });

  it('corta con 401 si el usuario del token ya no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException(SESSION_ENDED_MESSAGE),
    );
  });

  it('una ruta pública no consulta la base', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('Contraseña: mínimo 6 caracteres también en el backend', () => {
  const base = {
    name: 'Ana',
    username: 'ana',
    roleIds: ['3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'],
  };
  const errorsFor = async <T extends object>(cls: new () => T, body: object) =>
    (await validate(plainToInstance(cls, body))).filter(
      (e) => e.property === 'password',
    );

  it('al crear, rechaza una contraseña de 5 caracteres con un mensaje claro', async () => {
    const errors = await errorsFor(CreateAuthDto, {
      ...base,
      password: '12345',
    });
    expect(Object.values(errors[0]?.constraints ?? {})).toContain(
      'La contraseña debe tener al menos 6 caracteres',
    );
  });

  it('al crear, acepta 6 caracteres', async () => {
    expect(
      await errorsFor(CreateAuthDto, { ...base, password: '123456' }),
    ).toEqual([]);
  });

  it('al editar, rechaza una contraseña corta pero permite no mandarla', async () => {
    expect((await errorsFor(UpdateAuthDto, { password: '1' })).length).toBe(1);
    expect(await errorsFor(UpdateAuthDto, {})).toEqual([]);
  });

  it('el login no exige largo mínimo: las contraseñas viejas cortas siguen entrando', async () => {
    expect(
      await errorsFor(LoginAuthDto, { username: 'admin', password: '12345' }),
    ).toEqual([]);
  });
});
