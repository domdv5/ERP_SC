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
      // Lanzar la excepción (en vez de emitir un evento y cerrar) para que Nest
      // nunca alcance a fijar las cabeceras del stream: así se responde un 401
      // normal, que el EventSource del navegador toma como "conexión fallida" y no reintenta.
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
