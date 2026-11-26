import { Module } from '@nestjs/common';
import { SupplierPaymentsService } from './supplier-payments.service';
import { SupplierPaymentsController } from './supplier-payments.controller';

@Module({
  controllers: [SupplierPaymentsController],
  providers: [SupplierPaymentsService],
})
export class SupplierPaymentsModule {}
