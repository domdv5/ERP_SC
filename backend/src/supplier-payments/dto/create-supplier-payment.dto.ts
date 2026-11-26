import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TreasuryPaymentMethod } from '@prisma/client';
import { OFFICE_PAYMENT_METHODS } from '@/common/enums/office-payment-methods';
import { IsValidChequeReference } from '@/common/validators/is-valid-cheque-reference.validator';

/** Abono a una cuenta por pagar dentro del egreso (dinero + saldo a favor, sin distinguir todavía). */
export class SupplierPaymentPayableLineDto {
  @IsUUID()
  accountPayableId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

/** Saldo a favor del proveedor a aplicar; el reparto entre CxP lo decide el service (FIFO por antigüedad). */
export class SupplierPaymentCreditLineDto {
  @IsUUID()
  supplierCreditId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class SupplierPaymentMethodLineDto {
  @IsIn(OFFICE_PAYMENT_METHODS, {
    message:
      'La forma de pago debe ser efectivo_oficina o consignacion_oficina',
  })
  method!: TreasuryPaymentMethod;

  @IsNumber()
  @IsPositive()
  amount!: number;

  // Número de cheque o de consignación — VARCHAR(100) en la migración.
  @IsValidChequeReference()
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank?: string;
}

export class CreateSupplierPaymentDto {
  @IsUUID()
  supplierId!: string;

  // Sin default acá: el service lo resuelve a hoy (fecha del servidor) si se omite.
  @IsOptional()
  @IsDateString()
  date?: string;

  // VARCHAR(500) en la migración.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // La genera el frontend al abrir el formulario; un reintento con la misma clave no duplica si el resto del body coincide (ver SupplierPaymentsService.create).
  @IsUUID()
  idempotencyKey!: string;

  // Tope arbitrario para que un array gigante no mantenga bloqueada la fila
  // "EGRESO" de sequence más de lo razonable dentro de la transacción.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SupplierPaymentPayableLineDto)
  payables!: SupplierPaymentPayableLineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SupplierPaymentCreditLineDto)
  credits?: SupplierPaymentCreditLineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SupplierPaymentMethodLineDto)
  payments?: SupplierPaymentMethodLineDto[];
}
