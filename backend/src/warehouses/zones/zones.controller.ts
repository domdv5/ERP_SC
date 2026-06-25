import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateZoneDto, UpdateZoneDto } from '@/warehouses/zones/dto';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { ZonesService } from '@/warehouses/zones/zones.service';

@Controller('warehouses/:warehouseId/zones')
@Permissions('warehouse.manage')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  findAll(@Param('warehouseId') id: string) {
    return this.zonesService.findAll(id);
  }

  @Post()
  create(
    @Body() createZoneDto: CreateZoneDto,
    @Param('warehouseId') id: string,
  ) {
    return this.zonesService.create(createZoneDto, id);
  }

  @Patch(':zoneId')
  update(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() updateZoneDto: UpdateZoneDto,
  ) {
    return this.zonesService.update(updateZoneDto, zoneId);
  }
}
