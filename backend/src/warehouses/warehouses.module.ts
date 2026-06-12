import { Module } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { AuthModule } from '@/auth/auth.module';
import { PermissionsGuard } from '@/common/guards/permissions.guard';

@Module({
  controllers: [WarehousesController],
  providers: [WarehousesService, PermissionsGuard],
  imports: [AuthModule],
})
export class WarehousesModule {}
