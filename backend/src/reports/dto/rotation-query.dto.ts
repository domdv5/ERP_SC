import { IntersectionType } from '@nestjs/mapped-types';
import { IsOptional, IsUUID } from 'class-validator';
import { ReportRangeDto } from './report-range.dto';
import { ReportLimitDto } from './report-limit.dto';

export class RotationQueryDto extends IntersectionType(
  ReportRangeDto,
  ReportLimitDto,
) {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
