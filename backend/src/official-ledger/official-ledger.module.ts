import { Module } from '@nestjs/common';
import { OfficialLedgerService } from './official-ledger.service';
import { OfficialLedgerController } from './official-ledger.controller';

@Module({
  controllers: [OfficialLedgerController],
  providers: [OfficialLedgerService],
})
export class OfficialLedgerModule {}
