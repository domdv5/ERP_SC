import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Un saldo a favor del cliente aplicado a una venta: cuál y cuánto. */
export class AppliedCustomerCreditDto {
  @IsUUID()
  customerCreditId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

/** Body opcional de POST /documents/:id/confirm, solo lo usan POS/COT para aplicar saldos a favor del cliente. */
export class ConfirmDocumentDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppliedCustomerCreditDto)
  customerCredits?: AppliedCustomerCreditDto[];
}
