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

  async login(loginAuthDto: LoginAuthDto) {
    const { username, password } = loginAuthDto;
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const payload = {
      sub: user.id,
      name: user.name,
      username: user.username,
    };

    return {
      access_token: this.jwt.sign(payload),
    };
  }

  findAll() {
    return `This action returns all auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
