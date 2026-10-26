import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';

const SESSION_ENDED_MESSAGE =
  'Tu sesión ya no es válida. Inicia sesión de nuevo.';

const userRow = (tokenVersion: number) => ({
  id: 'u1',
  name: 'Ana',
  username: 'ana',
  password: bcrypt.hashSync('actual1', 4),
  active: true,
  tokenVersion,
  userRoles: [
    {
      role: {
        name: 'billing',
        rolePermissions: [{ permission: { code: 'product.read' } }],
      },
    },
  ],
});

describe('JwtAuthGuard: versión del token', () => {
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
  });

  it('deja pasar si la versión del token es la actual', async () => {
    jwtService.verify.mockReturnValue({ sub: 'u1', tokenVersion: 2 });
    prisma.user.findUnique.mockResolvedValue({ active: true, tokenVersion: 2 });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { active: true, tokenVersion: true },
    });
  });

  it('corta con 401 un token de una versión vieja', async () => {
    jwtService.verify.mockReturnValue({ sub: 'u1', tokenVersion: 1 });
    prisma.user.findUnique.mockResolvedValue({ active: true, tokenVersion: 2 });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException(SESSION_ENDED_MESSAGE),
    );
    expect(request.user).toBeUndefined();
  });

  it('corta con 401 un token emitido antes de que existiera la versión', async () => {
    jwtService.verify.mockReturnValue({ sub: 'u1' });
    prisma.user.findUnique.mockResolvedValue({ active: true, tokenVersion: 0 });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException(SESSION_ENDED_MESSAGE),
    );
  });
});

describe('AuthService: tokens con versión', () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    role: { findMany: jest.fn().mockResolvedValue([{ id: 'r1' }]) },
    userRole: {
      findMany: jest.fn().mockResolvedValue([{ roleId: 'r-viejo' }]),
    },
  };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('el login mete la versión actual del usuario en el token', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow(4));

    await service.login({ username: 'ana', password: 'actual1' });

    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'u1',
      name: 'Ana',
      username: 'ana',
      permissions: ['product.read'],
      roles: ['billing'],
      tokenVersion: 4,
    });
  });

  it('cambiar la contraseña sube la versión y devuelve un token nuevo con ella', async () => {
    prisma.user.findUnique.mockResolvedValue({
      password: bcrypt.hashSync('actual1', 4),
    });
    prisma.user.update.mockResolvedValue(userRow(5));

    await expect(
      service.changePassword('u1', {
        currentPassword: 'actual1',
        newPassword: 'nueva12',
      }),
    ).resolves.toEqual({ access_token: 'token' });

    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.tokenVersion).toEqual({ increment: 1 });
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', tokenVersion: 5 }),
    );
  });

  it('el admin al cambiar contraseña o roles sube la versión', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u1' });

    await service.update('u1', { password: 'nueva12' });
    await service.update('u1', {
      roleIds: ['3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b'],
    });

    expect(prisma.user.update.mock.calls[0][0].data.tokenVersion).toEqual({
      increment: 1,
    });
    expect(prisma.user.update.mock.calls[1][0].data.tokenVersion).toEqual({
      increment: 1,
    });
  });

  it('el admin guardando el formulario con los mismos roles no cierra las sesiones', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u1' });
    prisma.role.findMany.mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }]);
    prisma.userRole.findMany.mockResolvedValueOnce([
      { roleId: 'r2' },
      { roleId: 'r1' },
    ]);

    await service.update('u1', { name: 'Ana María', roleIds: ['r1', 'r2'] });

    expect(
      prisma.user.update.mock.calls[0][0].data.tokenVersion,
    ).toBeUndefined();
  });

  it('el admin al cambiar solo el nombre no cierra las sesiones', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u1' });

    await service.update('u1', { name: 'Ana María' });

    expect(
      prisma.user.update.mock.calls[0][0].data.tokenVersion,
    ).toBeUndefined();
  });
});
