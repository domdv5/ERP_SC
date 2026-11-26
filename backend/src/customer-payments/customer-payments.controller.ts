import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { CustomerPaymentsService } from './customer-payments.service';
import {
  CreateCustomerPaymentDto,
  FindAllCustomerPaymentsDto,
  FindOpenItemsDto,
  VoidCustomerPaymentDto,
} from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';
import type { RequestWithUser } from '@/common/types';

@Controller('customer-payments')
export class CustomerPaymentsController {
  constructor(
    private readonly customerPaymentsService: CustomerPaymentsService,
  ) {}

  @Get()
  @Permissions('customer_payment.read')
  findAll(@Query() findAllCustomerPaymentsDto: FindAllCustomerPaymentsDto) {
    return this.customerPaymentsService.findAll(findAllCustomerPaymentsDto);
  }

  // Debe declararse antes de GET :id — si no, Nest interpreta "clients" como el
  // param :id (mismo riesgo documentado en CLAUDE.md para GET /auth/roles).
  @Get('clients/:clientId/open-items')
  @Permissions('customer_payment.create')
  findOpenItems(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() findOpenItemsDto: FindOpenItemsDto,
  ) {
    return this.customerPaymentsService.findOpenItems(
      clientId,
      findOpenItemsDto.customerBranchId,
    );
  }

  @Get(':id')
  @Permissions('customer_payment.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerPaymentsService.findOne(id);
  }

  @Post()
  @Permissions('customer_payment.create')
  create(
    @Body() createCustomerPaymentDto: CreateCustomerPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.customerPaymentsService.create(
      createCustomerPaymentDto,
      req.user,
    );
  }

  @Post(':id/void')
  @Permissions('customer_payment.void')
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() voidCustomerPaymentDto: VoidCustomerPaymentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.customerPaymentsService.void(
      id,
      voidCustomerPaymentDto,
      req.user,
    );
  }
}
