import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EgresoPaymentMethod } from '@prisma/client';
import { IsValidChequeReference } from '@/common/validators/is-valid-cheque-reference.validator';

/** Abono a una cuenta por pagar dentro del egreso (dinero + saldo a favor, sin distinguir todavía). */
export class EgresoPayableLineDto {
  @IsUUID()
  accountPayableId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

/** Saldo a favor del proveedor a aplicar; el reparto entre CxP lo decide el service (FIFO por antigüedad). */
export class EgresoCreditLineDto {
  @IsUUID()
  supplierCreditId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class EgresoPaymentLineDto {
  @IsEnum(EgresoPaymentMethod)
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

export class CreateEgresoDto {
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

  // La genera el frontend al abrir el formulario; un reintento con la misma clave no duplica si el resto del body coincide (ver EgresosService.create).
  @IsUUID()
  idempotencyKey!: string;

  // Tope arbitrario para que un array gigante no mantenga bloqueada la fila
  // "EGRESO" de sequence más de lo razonable dentro de la transacción.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EgresoPayableLineDto)
  payables!: EgresoPayableLineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EgresoCreditLineDto)
  credits?: EgresoCreditLineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EgresoPaymentLineDto)
  payments?: EgresoPaymentLineDto[];
}
