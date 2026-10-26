import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ChangePasswordDto,
  CreateAuthDto,
  UpdateAuthDto,
  LoginAuthDto,
  FindAllUsersDto,
} from './dto/index';
import { Prisma } from '@prisma/client';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

const TOKEN_USER_INCLUDE = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type TokenUser = Prisma.UserGetPayload<{ include: typeof TOKEN_USER_INCLUDE }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async create(createAuthDto: CreateAuthDto) {
    const { password, roleIds, ...rest } = createAuthDto;

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (roles.length !== roleIds.length) {
      throw new NotFoundException('Uno o más roles no existen');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        ...rest,
        password: hashedPassword,
        userRoles: {
          create: roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: { id: true, name: true, username: true },
    });
  }

  async login(loginAuthDto: LoginAuthDto) {
    const { username, password } = loginAuthDto;

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: TOKEN_USER_INCLUDE,
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    // Después de la contraseña: solo quien ya la sabe se entera de que el usuario existe y está desactivado.
    if (!user.active) {
      throw new UnauthorizedException(
        'Tu usuario está desactivado. Pide al administrador que lo active.',
      );
    }

    return this.signToken(user);
  }

  // Los permisos quedan horneados en el JWT; los guards los leen del token sin consultar la DB.
  private signToken(user: TokenUser) {
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    );

    const payload: JwtPayload = {
      sub: user.id,
      name: user.name,
      username: user.username,
      permissions,
      roles: user.userRoles.map((ur) => ur.role.name),
      tokenVersion: user.tokenVersion,
    };

    return { access_token: this.jwt.sign(payload) };
  }

  async update(id: string, updateAuthDto: UpdateAuthDto) {
    const { roleIds, password, ...rest } = updateAuthDto;

    if (roleIds?.length) {
      const roles = await this.prisma.role.findMany({
        where: { id: { in: roleIds } },
      });
      if (roles.length !== roleIds.length) {
        throw new NotFoundException('Uno o más roles no existen');
      }
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;
    const endsSessions = hashedPassword !== undefined || !!roleIds?.length;

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(hashedPassword !== undefined && { password: hashedPassword }),
        ...(endsSessions && { tokenVersion: { increment: 1 } }),
        ...rest,
        ...(roleIds?.length && {
          userRoles: {
            deleteMany: {},
            create: roleIds.map((roleId) => ({ roleId })),
          },
        }),
      },
      select: { id: true, name: true, username: true },
    });
  }

  // 400 y no 401: el frontend cierra la sesión ante cualquier 401
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }

    // Cierra las demás sesiones; quien la cambió sigue con el token nuevo
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(dto.newPassword, 10),
        tokenVersion: { increment: 1 },
      },
      include: TOKEN_USER_INCLUDE,
    });
    return this.signToken(updated);
  }

  async remove(id: string) {
    await this.prisma.user.findFirstOrThrow({ where: { id } });

    // Sin cascade en el schema: hay que borrar roles antes que el usuario, ambos pasos atómicos en la misma transacción.
    try {
      await this.prisma.$transaction([
        this.prisma.userRole.deleteMany({ where: { userId: id } }),
        this.prisma.user.delete({ where: { id } }),
      ]);
    } catch (error) {
      // Si el usuario ya tiene actividad asociada (documentos, movimientos, etc.)
      // devolvemos un 409 explicativo en vez del 400 genérico de Prisma.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar: el usuario tiene documentos u operaciones asociadas',
        );
      }
      throw error;
    }
  }

  async findAll(dto: FindAllUsersDto) {
    const { page = 1, limit = 20, search, roleId, active } = dto;
    const skip = (page - 1) * limit;

    // Sin default de `active`: el listado muestra activos e inactivos salvo
    // que el filtro lo acote explícitamente.
    const where: Prisma.UserWhereInput = {
      ...(active !== undefined && { active }),
      ...(roleId && { userRoles: { some: { roleId } } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total, activeCount, adminCount] =
      await this.prisma.$transaction([
        this.prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            username: true,
            active: true,
            createdAt: true,
            userRoles: {
              select: {
                role: { select: { id: true, name: true, description: true } },
              },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where }),
        this.prisma.user.count({ where: { ...where, active: true } }),
        this.prisma.user.count({
          where: { ...where, userRoles: { some: { role: { name: 'admin' } } } },
        }),
      ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        activeCount,
        adminCount,
      },
    };
  }

  async findAllRoles() {
    return this.prisma.role.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        description: true,
        rolePermissions: {
          select: {
            permission: { select: { id: true, code: true, module: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
