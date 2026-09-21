import { Controller, Get, Param, Query } from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import {
  FindAllAccountsPayableDto,
  FindAvailableCreditsDto,
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

  // Debe declararse antes de GET :id — si no, Nest interpreta "credits" como el
  // param :id (mismo riesgo documentado en CLAUDE.md para GET /auth/roles).
  @Get('credits')
  @Permissions('ap.read')
  findAvailableCredits(
    @Query() findAvailableCreditsDto: FindAvailableCreditsDto,
  ) {
    return this.accountsPayableService.findAvailableCredits(
      findAvailableCreditsDto,
    );
  }

  // Mismo motivo de orden que "credits" arriba: "suppliers" no debe caer en :id.
  @Get('suppliers/:supplierId/statement')
  @Permissions('ap.read')
  statement(@Param('supplierId') supplierId: string) {
    return this.accountsPayableService.statement(supplierId);
  }

  @Get(':id')
  @Permissions('ap.read')
  findOne(@Param('id') id: string) {
    return this.accountsPayableService.findOne(id);
  }
}
