import { Injectable } from '@nestjs/common';
import {
  normalizeIp,
  ThrottlerGuard,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { AuthController } from '@/auth/auth.controller';

export const THROTTLER_OPTIONS = {
  throttlers: [
    { name: 'default', ttl: 60_000, limit: 300 },
    // Solo en login, por IP sola: frena probar una contraseña contra muchas cuentas desde una IP
    {
      name: 'loginIp',
      ttl: 60_000,
      limit: 30,
      getTracker: (req: Record<string, any>) => normalizeIp(String(req.ip)),
      skipIf: (context) =>
        context.getHandler() !== AuthController.prototype.login,
    },
  ],
  errorMessage:
    'Demasiadas solicitudes seguidas. Espera un momento e intenta de nuevo.',
} satisfies ThrottlerModuleOptions;

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  // Logueado: cupo por persona. Sin token (login): por IP + usuario escrito, así un atacante no bloquea a la oficina
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId: unknown = req.user?.sub;
    if (userId) return `user:${String(userId)}`;

    const ip = await super.getTracker(req);
    const username: unknown = req.body?.username;
    const typedName =
      typeof username === 'string' ? username.trim().toLowerCase() : '';
    return `${ip}:${typedName}`;
  }
}
