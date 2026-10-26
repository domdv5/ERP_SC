import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('AuthService.changePassword', () => {
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    { sign: jest.fn().mockReturnValue('token') } as unknown as JwtService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      password: bcrypt.hashSync('actual1', 4),
    });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      tokenVersion: 1,
      userRoles: [],
    });
  });

  it('guarda la nueva contraseña hasheada si la actual es correcta', async () => {
    await service.changePassword('u1', {
      currentPassword: 'actual1',
      newPassword: 'nueva12',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { password: true },
    });
    const { where, data } = prisma.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'u1' });
    expect(bcrypt.compareSync('nueva12', data.password)).toBe(true);
  });

  it('rechaza con 400 si la contraseña actual no coincide y no escribe', async () => {
    const call = service.changePassword('u1', {
      currentPassword: 'otra',
      newPassword: 'nueva12',
    });

    await expect(call).rejects.toThrow(
      new BadRequestException('La contraseña actual no es correcta.'),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('responde 404 si el usuario del token ya no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('u1', {
        currentPassword: 'actual1',
        newPassword: 'nueva12',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('ChangePasswordDto', () => {
  const errorsFor = async (body: object) =>
    validate(plainToInstance(ChangePasswordDto, body));

  it('exige al menos 6 caracteres en la nueva contraseña', async () => {
    const errors = await errorsFor({
      currentPassword: 'actual1',
      newPassword: '12345',
    });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      'La contraseña debe tener al menos 6 caracteres',
    );
  });

  it('exige la contraseña actual', async () => {
    const errors = await errorsFor({ newPassword: '123456' });
    expect(errors.map((e) => e.property)).toEqual(['currentPassword']);
  });

  it('acepta un cuerpo válido', async () => {
    expect(
      await errorsFor({ currentPassword: 'x', newPassword: '123456' }),
    ).toEqual([]);
  });
});
