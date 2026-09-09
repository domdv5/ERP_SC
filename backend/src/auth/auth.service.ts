import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreateAuthDto,
  UpdateAuthDto,
  LoginAuthDto,
  FindAllUsersDto,
} from './dto/index';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

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
      include: {
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
      },
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    );

    const roles = user.userRoles.map((ur) => ur.role.name);

    // Los permisos se calculan una sola vez aquí y quedan horneados en el JWT;
    // los guards los leen del token en cada request sin consultar la DB.
    const payload = {
      sub: user.id,
      name: user.name,
      username: user.username,
      permissions,
      roles,
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

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(hashedPassword !== undefined && { password: hashedPassword }),
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

  async remove(id: string) {
    await this.prisma.user.findFirstOrThrow({ where: { id } });

    // El schema no borra los roles en cascada y todo usuario tiene al menos uno,
    // así que hay que quitarlos primero. La transacción hace ambos pasos atómicos:
    // si el borrado del usuario falla por otra llave foránea, los roles vuelven.
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
