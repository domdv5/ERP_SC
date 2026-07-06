import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import {
  FindAllAccountsPayableDto,
  RegisterPayablePaymentDto,
} from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';

@Controller('accounts-payable')
export class AccountsPayableController {
  constructor(
    private readonly accountsPayableService: AccountsPayableService,
  ) {}

  @Get()
  @Permissions('ap.read')
  findAll(@Query() findAllAccountsPayableDto: FindAllAccountsPayableDto) {
    return this.accountsPayableService.findAll(findAllAccountsPayableDto);
  }

  @Get(':id')
  @Permissions('ap.read')
  findOne(@Param('id') id: string) {
    return this.accountsPayableService.findOne(id);
  }

  @Post(':id/payments')
  @Permissions('ap.manage')
  registerPayment(
    @Param('id') id: string,
    @Body() registerPayablePaymentDto: RegisterPayablePaymentDto,
  ) {
    return this.accountsPayableService.registerPayment(
      id,
      registerPayablePaymentDto,
    );
  }
}
