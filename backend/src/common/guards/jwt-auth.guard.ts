import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { RequestWithUser } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de token inválido');
    }

    let payload: RequestWithUser['user'];
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Desactivar o borrar un usuario corta su acceso en el pedido siguiente, sin esperar a que venza el token.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { active: true },
    });
    if (!user?.active) {
      throw new UnauthorizedException(
        'Tu sesión ya no es válida. Inicia sesión de nuevo.',
      );
    }

    request.user = payload;
    return true;
  }
}
