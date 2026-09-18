import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { EgresosService } from './egresos.service';
import { CreateEgresoDto, FindAllEgresosDto } from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('egresos')
export class EgresosController {
  constructor(private readonly egresosService: EgresosService) {}

  @Get()
  @Permissions('egreso.read')
  findAll(@Query() findAllEgresosDto: FindAllEgresosDto) {
    return this.egresosService.findAll(findAllEgresosDto);
  }

  // Debe declararse antes de GET :id — si no, Nest interpreta "suppliers" como el
  // param :id (mismo riesgo documentado en CLAUDE.md para GET /auth/roles).
  @Get('suppliers/:supplierId/open-items')
  @Permissions('egreso.create')
  findOpenItems(@Param('supplierId') supplierId: string) {
    return this.egresosService.findOpenItems(supplierId);
  }

  @Get(':id')
  @Permissions('egreso.read')
  findOne(@Param('id') id: string) {
    return this.egresosService.findOne(id);
  }

  @Post()
  @Permissions('egreso.create')
  create(
    @Body() createEgresoDto: CreateEgresoDto,
    @Req() req: RequestWithUser,
  ) {
    return this.egresosService.create(createEgresoDto, req.user);
  }
}
