import { IsUUID } from 'class-validator';

export class FindAvailableSupplierCreditsDto {
  @IsUUID()
  supplierId!: string;
}
