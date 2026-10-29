import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export const NO_BRANCH_FILTER = 'none';

export class FindOpenItemsDto {
  // UUID de sucursal, o "none" para las CxC sin sucursal.
  @IsOptional()
  @ValidateIf((o: FindOpenItemsDto) => o.customerBranchId !== NO_BRANCH_FILTER)
  @IsUUID()
  customerBranchId?: string;
}
