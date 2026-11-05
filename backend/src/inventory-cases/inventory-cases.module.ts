import { Module } from '@nestjs/common';
import { InventoryCasesController } from './inventory-cases.controller';
import { InventoryCasesService } from './inventory-cases.service';

@Module({
  controllers: [InventoryCasesController],
  providers: [InventoryCasesService],
})
export class InventoryCasesModule {}
