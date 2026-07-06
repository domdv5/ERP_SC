import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AccountsReceivableService } from './accounts-receivable.service';
import {
  FindAllAccountsReceivableDto,
  RegisterReceivablePaymentDto,
} from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';

@Controller('accounts-receivable')
export class AccountsReceivableController {
  constructor(
    private readonly accountsReceivableService: AccountsReceivableService,
  ) {}

  @Get()
  @Permissions('ar.read')
  findAll(@Query() findAllAccountsReceivableDto: FindAllAccountsReceivableDto) {
    return this.accountsReceivableService.findAll(findAllAccountsReceivableDto);
  }

  @Get(':id')
  @Permissions('ar.read')
  findOne(@Param('id') id: string) {
    return this.accountsReceivableService.findOne(id);
  }

  @Post(':id/payments')
  @Permissions('ar.manage')
  registerPayment(
    @Param('id') id: string,
    @Body() registerReceivablePaymentDto: RegisterReceivablePaymentDto,
  ) {
    return this.accountsReceivableService.registerPayment(
      id,
      registerReceivablePaymentDto,
    );
  }
}
