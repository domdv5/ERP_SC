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

/** Aplicación de un saldo a favor (nota crédito de proveedor) contra el pago que se está registrando. */
export class CreditApplicationDto {
  @IsUUID()
  supplierCreditId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class RegisterPayablePaymentDto {
  // Se permite 0 (no solo positivos): un pago cubierto solo con nota crédito
  // registra efectivo 0. La validación de "pago vacío" está en el service.
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
