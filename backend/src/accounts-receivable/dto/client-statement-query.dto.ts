import { IsOptional, IsUUID } from 'class-validator';

export class ClientStatementQueryDto {
  @IsOptional()
  @IsUUID()
  customerBranchId?: string;
}
