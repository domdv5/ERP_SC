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
  registerDecorator,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EgresoPaymentMethod } from '@prisma/client';

/**
 * Valida `reference` como texto opcional de máximo 100 caracteres, pero
 * obligatorio (no vacío) cuando `method === 'cheque'`. No se puede armar con
 * @IsOptional()/@ValidateIf() porque ambos descartan TODOS los validadores del
 * campo cuando su condición es falsa — con @IsOptional, un cheque sin `reference`
 * (undefined) nunca llegaría a validarse como "requerido". Un solo validador
 * custom evita el atajo.
 */
function IsValidChequeReference(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidChequeReference',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const line = args.object as EgresoPaymentLineDto;
          const isCheque = line.method === EgresoPaymentMethod.cheque;

          if (value === undefined || value === null) {
            return !isCheque;
          }
          if (typeof value !== 'string' || value.length > 100) {
            return false;
          }
          if (isCheque && value.trim().length === 0) {
            return false;
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const line = args.object as EgresoPaymentLineDto;
          return line.method === EgresoPaymentMethod.cheque
            ? 'El número de cheque es obligatorio para este método de pago'
            : 'reference debe ser un texto de máximo 100 caracteres';
        },
      },
    });
  };
}

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

  // La genera el frontend (crypto.randomUUID()) al abrir el formulario y la reenvía
  // igual en un reintento; el service devuelve el egreso ya creado en vez de duplicarlo
  // solo si el resto del body coincide (ver EgresosService.create).
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
