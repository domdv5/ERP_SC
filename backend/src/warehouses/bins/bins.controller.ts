import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateBinDto, UpdateBinDto } from '@/warehouses/bins/dto';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { BinsService } from '@/warehouses/bins/bins.service';

@Controller('warehouses/:warehouseId/zones/:zoneId/bins')
@Permissions('warehouse.manage')
export class BinsController {
  constructor(private readonly binService: BinsService) {}

  @Get()
  findAll(@Param('zoneId', ParseUUIDPipe) zoneId: string) {
    return this.binService.findAll(zoneId);
  }

  @Post()
  create(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() createBinDto: CreateBinDto,
  ) {
    return this.binService.create(createBinDto, zoneId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBinDto: UpdateBinDto,
  ) {
    return this.binService.update(updateBinDto, id);
  }
}
