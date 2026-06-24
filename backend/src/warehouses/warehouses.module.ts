import { Module } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { AuthModule } from '@/auth/auth.module';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { ZonesService } from './zones/zones.service';
import { BinsService } from './bins/bins.service';
import { BinsController } from './bins/bins.controller';
import { ZonesController } from './zones/zones.controller';

@Module({
  controllers: [WarehousesController, BinsController, ZonesController],
  providers: [WarehousesService, PermissionsGuard, ZonesService, BinsService],
  imports: [AuthModule],
})
export class WarehousesModule {}
