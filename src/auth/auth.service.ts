import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAuthDto, UpdateAuthDto, LoginAuthDto } from '@/auth/dto/index';
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

    const payload = {
      sub: user.id,
      name: user.name,
      username: user.username,
      permissions,
    };

    return { access_token: this.jwt.sign(payload) };
  }

  async update(id: string, updateAuthDto: UpdateAuthDto) {
    const { roleIds, ...rest } = updateAuthDto;

    if (roleIds?.length) {
      const roles = await this.prisma.role.findMany({
        where: { id: { in: roleIds } },
      });
      if (roles.length !== roleIds.length) {
        throw new NotFoundException('Uno o más roles no existen');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
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
    await this.prisma.user.delete({ where: { id } });
  }
}
