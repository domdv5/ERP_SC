import { Module } from '@nestjs/common';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { ExcedentesController } from './excedentes.controller';
import { ExcedentesService } from './excedentes.service';

@Module({
  controllers: [AccountsReceivableController, ExcedentesController],
  providers: [AccountsReceivableService, ExcedentesService],
})
export class AccountsReceivableModule {}
