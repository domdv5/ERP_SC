import { IsOptional, IsUUID } from 'class-validator';
import { ReportRangeDto } from '@/reports/dto/index';

export class InventoryCaseReportQueryDto extends ReportRangeDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
