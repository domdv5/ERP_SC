import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { CreditsService } from './credits.service';
import { FindCreditsDto } from './dto/index';

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('customers')
  @Permissions('ar.read')
  findCustomers(@Query() findCreditsDto: FindCreditsDto) {
    return this.creditsService.findCustomers(findCreditsDto);
  }

  @Get('customers/:id')
  @Permissions('ar.read')
  findCustomerDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.findCustomerDetail(id);
  }

  @Get('suppliers')
  @Permissions('ap.read')
  findSuppliers(@Query() findCreditsDto: FindCreditsDto) {
    return this.creditsService.findSuppliers(findCreditsDto);
  }

  @Get('suppliers/:id')
  @Permissions('ap.read')
  findSupplierDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditsService.findSupplierDetail(id);
  }
}
