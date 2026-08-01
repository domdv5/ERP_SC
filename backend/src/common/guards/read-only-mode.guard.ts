import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { BYPASS_READ_ONLY_KEY } from '@/common/decorators/bypass-read-only.decorator';
import { SystemConfigService } from '@/system-config/system-config.service';

const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

@Injectable()
export class ReadOnlyModeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method: string }>();

    if (!WRITE_METHODS.includes(request.method)) return true;

    const isExempt =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>(BYPASS_READ_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (isExempt) return true;

    if (!this.systemConfigService.getStatus().readOnlyMode) return true;

    throw new ForbiddenException(
      'La aplicación está en modo de solo lectura por cierre contable mensual. Contacta a un administrador para reactivarla.',
    );
  }
}
