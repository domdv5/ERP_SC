import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { ReportLimitDto, ReportRangeDto, RotationQueryDto } from './dto';
import { resolveReportRange } from './helpers/resolve-report-range';
import { ReportsService } from './reports.service';

@Controller('reports')
@Permissions('report.read')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('inventory')
  getInventory() {
    return this.reportsService.getInventory();
  }

  @Get('rotation')
  getRotation(@Query() query: RotationQueryDto) {
    return this.reportsService.getRotation(
      resolveReportRange(query.from, query.to),
      query.warehouseId ?? null,
      query.limit ?? 10,
    );
  }

  @Get('accounts')
  getAccounts(@Query() query: ReportLimitDto) {
    return this.reportsService.getAccounts(query.limit ?? 10);
  }

  @Get('sales-by-seller')
  getSalesBySeller(@Query() query: ReportRangeDto) {
    return this.reportsService.getSalesBySeller(
      resolveReportRange(query.from, query.to),
    );
  }
}
