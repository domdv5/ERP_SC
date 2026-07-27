import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Una aplicación de saldo a favor (SupplierCredit) contra el pago que se está registrando. */
export class CreditApplicationDto {
  @IsUUID()
  supplierCreditId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class RegisterPayablePaymentDto {
  // Min(0) en vez de IsPositive: una aplicación de solo nota crédito registra
  // efectivo 0 (ver Plan 020 — validación de "pago vacío" vive en el service).
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  bankDestination?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditApplicationDto)
  creditApplications?: CreditApplicationDto[];
}
