import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Sse,
  MessageEvent,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import { SystemConfigService } from './system-config.service';
import { ToggleReadOnlyDto } from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { BypassReadOnly } from '@/common/decorators/bypass-read-only.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('system')
export class SystemConfigController {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('status')
  getStatus() {
    return this.systemConfigService.getStatus();
  }

  // @Public() porque EventSource del navegador no puede mandar el header
  // Authorization — el JWT viaja como query param y se valida manualmente aquí.
  @Public()
  @Sse('status/stream')
  statusStream(@Req() req: Request): Observable<MessageEvent> {
    const token = req.query.token as string | undefined;

    if (!token) {
      // Lanzar (no emitir+completar) para que Nest nunca llegue a fijar los
      // headers SSE: la excepción se responde como un 401 HTTP normal, que el
      // EventSource nativo interpreta como "fail the connection" (sin reintentos).
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    return this.systemConfigService.statusChanges$.pipe(
      map((status) => ({ data: status })),
    );
  }

  // Requiere ambos decoradores: sin @BypassReadOnly() nadie podría desactivar
  // el modo de solo lectura una vez encendido, quedando la app bloqueada.
  @Post('read-only/toggle')
  @Permissions('system.manage')
  @BypassReadOnly()
  toggle(@Body() dto: ToggleReadOnlyDto, @Req() req: RequestWithUser) {
    return this.systemConfigService.setReadOnlyMode(dto.active, req.user.sub);
  }
}
