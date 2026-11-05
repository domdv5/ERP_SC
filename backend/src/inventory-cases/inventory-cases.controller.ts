import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';
import { resolveReportRange } from '@/reports/helpers/resolve-report-range';
import {
  CloseInventoryCaseDto,
  FindInventoryCasesDto,
  InventoryCaseReportQueryDto,
} from './dto/index';
import { InventoryCasesService } from './inventory-cases.service';

@Controller('inventory-cases')
export class InventoryCasesController {
  constructor(private readonly inventoryCasesService: InventoryCasesService) {}

  @Get()
  @Permissions('inventory_case.read')
  findAll(@Query() findInventoryCasesDto: FindInventoryCasesDto) {
    return this.inventoryCasesService.findAll(findInventoryCasesDto);
  }

  // Las rutas fijas van antes de ':id'.
  @Get('open-count')
  @Permissions('inventory_case.read')
  getOpenCount() {
    return this.inventoryCasesService.getOpenCount();
  }

  @Get('report')
  @Permissions('inventory_case.read')
  getReport(@Query() query: InventoryCaseReportQueryDto) {
    return this.inventoryCasesService.getReport(
      resolveReportRange(query.from, query.to),
      query.warehouseId ?? null,
    );
  }

  @Get(':id')
  @Permissions('inventory_case.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryCasesService.findOne(id);
  }

  @Post(':id/close')
  @Permissions('inventory_case.close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() closeInventoryCaseDto: CloseInventoryCaseDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inventoryCasesService.close(
      id,
      closeInventoryCaseDto,
      req.user.sub,
    );
  }

  @Post(':id/reopen')
  @Permissions('inventory_case.reopen')
  reopen(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.inventoryCasesService.reopen(id, req.user.sub);
  }
}
