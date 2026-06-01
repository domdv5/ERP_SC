import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    const { password, roleId, ...rest } = createAuthDto;

    await this.prisma.role.findFirstOrThrow({
      where: { id: roleId },
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        ...rest,
        password: hashedPassword,
        userRoles: {
          create: {
            roleId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
    });
  }

  // async login(loginAuthDto: LoginAuthDto) {
  //   const { username, password } = loginAuthDto;
  //   const user = await this.prisma.user.findUnique({
  //     where: { username },
  //   });

  //   if (!user) throw new UnauthorizedException('Credenciales inválidas');

  //   const valid = await bcrypt.compare(password, user.password);

  //   if (!valid) throw new UnauthorizedException('Credenciales inválidas');

  //   const payload = {
  //     sub: user.id,
  //     name: user.name,
  //     username: user.username,
  //   };

  //   return {
  //     access_token: this.jwt.sign(payload),
  //   };
  // }

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
                  include: {
                    permission: true,
                  },
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

    return {
      access_token: this.jwt.sign(payload),
    };
  }

  findAll() {
    return `This action returns all auth`;
  }

  async update(id: string, updateAuthDto: UpdateAuthDto) {
    const { roleId } = updateAuthDto;

    await this.prisma.user.findFirstOrThrow({ where: { id } });

    if (roleId) {
      await this.prisma.role.findFirstOrThrow({ where: { id: roleId } });

      await this.prisma.$transaction([
        this.prisma.userRole.deleteMany({ where: { userId: id } }),
        this.prisma.userRole.create({ data: { userId: id, roleId } }),
      ]);
    }

    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, username: true },
    });
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
