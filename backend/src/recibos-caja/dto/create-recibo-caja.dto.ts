import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EgresoPaymentMethod, ReciboCajaDiscountReason } from '@prisma/client';
import { OFFICE_PAYMENT_METHODS } from '@/common/enums/office-payment-methods';
import { IsValidChequeReference } from '@/common/validators/is-valid-cheque-reference.validator';

/** Abono a una cuenta por cobrar dentro del recibo de caja. */
export class ReciboCajaReceivableLineDto {
  @IsUUID()
  accountReceivableId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

/** Excedente (saldo a favor por pago de más) usado como pago en este recibo. */
export class ReciboCajaExcedenteLineDto {
  @IsUUID()
  customerCreditId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class ReciboCajaPaymentLineDto {
  @IsIn(OFFICE_PAYMENT_METHODS, {
    message:
      'La forma de pago debe ser efectivo_oficina o consignacion_oficina',
  })
  method!: EgresoPaymentMethod;

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

export class ReciboCajaDiscountDto {
  @IsEnum(ReciboCajaDiscountReason, {
    message: 'Selecciona un motivo de descuento válido',
  })
  reason!: ReciboCajaDiscountReason;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class CreateReciboCajaDto {
  @IsUUID()
  clientId!: string;

  // Obligatoria si el cliente tiene sucursales activas y se cobra una CxC con sucursal; omitida = recibo de CxC sin sucursal.
  @IsOptional()
  @IsUUID()
  customerBranchId?: string;

  // Sin default acá: el service lo resuelve a hoy (fecha del servidor) si se omite.
  // Solo YYYY-MM-DD: IsDateString() solo acepta ISO 8601 completo, y el service
  // compara este string contra "hoy" lexicográficamente (mismo formato) — un
  // datetime con hora se rechazaría como futuro aunque fuera el mismo día.
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  date?: string;

  // VARCHAR(500) en la migración.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // La genera el frontend al abrir el formulario; un reintento con la misma clave no duplica si el resto del body coincide (ver RecibosCajaService.create).
  @IsUUID()
  idempotencyKey!: string;

  // Tope arbitrario para que un array gigante no mantenga bloqueada la fila
  // "RECIBO_CAJA" de sequence más de lo razonable dentro de la transacción.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReciboCajaReceivableLineDto)
  receivables!: ReciboCajaReceivableLineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReciboCajaPaymentLineDto)
  payments?: ReciboCajaPaymentLineDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ReciboCajaDiscountDto)
  discount?: ReciboCajaDiscountDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReciboCajaExcedenteLineDto)
  excedentes?: ReciboCajaExcedenteLineDto[];
}
