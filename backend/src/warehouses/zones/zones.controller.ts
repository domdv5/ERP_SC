import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CreateZoneDto, UpdateZoneDto } from '@/warehouses/zones/dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { ZonesService } from '@/warehouses/zones/zones.service';

@Controller('warehouses/:warehouseId/zones')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Permissions('warehouse.manage')
  @Get(':id')
  findAll(@Param('warehouseId') id: string) {
    return this.zonesService.findAll(id);
  }

  @Permissions('warehouse.manage')
  @Post()
  create(
    @Body() createZoneDto: CreateZoneDto,
    @Param('warehouseId') id: string,
  ) {
    return this.zonesService.create(createZoneDto, id);
  }

  @Permissions('warehouse.manage')
  @Patch(':id')
  update(
    @Body() updateZoneDto: UpdateZoneDto,
    @Param('warehouseId') id: string,
  ) {
    return this.zonesService.update(updateZoneDto, id);
  }
}
