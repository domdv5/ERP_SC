import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { OfficialLedgerService } from './official-ledger.service';
import {
  FindOfficialLedgerDto,
  FindOfficialLedgerMovementsDto,
} from './dto/index';
import { Permissions } from '@/common/decorators/permissions.decorator';

@Controller('official-ledger')
@Permissions('official.read')
export class OfficialLedgerController {
  constructor(private readonly officialLedgerService: OfficialLedgerService) {}

  @Get()
  findAll(@Query() findOfficialLedgerDto: FindOfficialLedgerDto) {
    return this.officialLedgerService.findAll(findOfficialLedgerDto);
  }

  @Get('products/:productId')
  findProductMovements(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() findOfficialLedgerMovementsDto: FindOfficialLedgerMovementsDto,
  ) {
    return this.officialLedgerService.findProductMovements(
      productId,
      findOfficialLedgerMovementsDto,
    );
  }
}
