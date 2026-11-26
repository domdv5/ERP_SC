import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { SupplierPaymentsService } from './supplier-payments.service';
import {
  CreateSupplierPaymentDto,
  FindAllSupplierPaymentsDto,
  VoidSupplierPaymentDto,
} from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('supplier-payments')
export class SupplierPaymentsController {
  constructor(
    private readonly supplierPaymentsService: SupplierPaymentsService,
  ) {}

  @Get()
  @Permissions('supplier_payment.read')
  findAll(@Query() findAllSupplierPaymentsDto: FindAllSupplierPaymentsDto) {
    return this.supplierPaymentsService.findAll(findAllSupplierPaymentsDto);
  }

  // Debe declararse antes de GET :id — si no, Nest interpreta "suppliers" como el
  // param :id (mismo riesgo documentado en CLAUDE.md para GET /auth/roles).
  @Get('suppliers/:supplierId/open-items')
  @Permissions('supplier_payment.create')
  findOpenItems(@Param('supplierId') supplierId: string) {
    return this.supplierPaymentsService.findOpenItems(supplierId);
  }

  @Get(':id')
  @Permissions('supplier_payment.read')
  findOne(@Param('id') id: string) {
    return this.supplierPaymentsService.findOne(id);
  }

  @Post()
  @Permissions('supplier_payment.create')
  create(
    @Body() createSupplierPaymentDto: CreateSupplierPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.supplierPaymentsService.create(
      createSupplierPaymentDto,
      req.user,
    );
  }

  @Post(':id/void')
  @Permissions('supplier_payment.void')
  void(
    @Param('id') id: string,
    @Body() voidSupplierPaymentDto: VoidSupplierPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.supplierPaymentsService.void(
      id,
      voidSupplierPaymentDto,
      req.user,
    );
  }
}
