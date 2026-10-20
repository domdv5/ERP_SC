import { Controller, Get, Param, Query } from '@nestjs/common';
import { AccountsReceivableService } from './accounts-receivable.service';
import {
  ClientStatementQueryDto,
  FindAllAccountsReceivableDto,
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

  // "clients" debe declararse antes de :id para que no lo capture como id.
  @Get('clients/:clientId/statement')
  @Permissions('ar.read')
  getClientStatement(
    @Param('clientId') clientId: string,
    @Query() { customerBranchId }: ClientStatementQueryDto,
  ) {
    return this.accountsReceivableService.getClientStatement(
      clientId,
      customerBranchId,
    );
  }

  @Get(':id')
  @Permissions('ar.read')
  findOne(@Param('id') id: string) {
    return this.accountsReceivableService.findOne(id);
  }
}
