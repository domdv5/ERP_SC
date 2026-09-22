import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { RecibosCajaService } from './recibos-caja.service';
import { CreateReciboCajaDto, FindAllRecibosCajaDto } from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('recibos-caja')
export class RecibosCajaController {
  constructor(private readonly recibosCajaService: RecibosCajaService) {}

  @Get()
  @Permissions('recibo.read')
  findAll(@Query() findAllRecibosCajaDto: FindAllRecibosCajaDto) {
    return this.recibosCajaService.findAll(findAllRecibosCajaDto);
  }

  // Debe declararse antes de GET :id — si no, Nest interpreta "clients" como el
  // param :id (mismo riesgo documentado en CLAUDE.md para GET /auth/roles).
  @Get('clients/:clientId/open-items')
  @Permissions('recibo.create')
  findOpenItems(@Param('clientId') clientId: string) {
    return this.recibosCajaService.findOpenItems(clientId);
  }

  @Get(':id')
  @Permissions('recibo.read')
  findOne(@Param('id') id: string) {
    return this.recibosCajaService.findOne(id);
  }

  @Post()
  @Permissions('recibo.create')
  create(
    @Body() createReciboCajaDto: CreateReciboCajaDto,
    @Req() req: RequestWithUser,
  ) {
    return this.recibosCajaService.create(createReciboCajaDto, req.user);
  }
}
