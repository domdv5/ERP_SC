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
  Matches,
  MaxLength,
  registerDecorator,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EgresoPaymentMethod } from '@prisma/client';

/** Valida `reference`: opcional salvo si `method === 'cheque'` — mismo validador que EgresoPaymentLineDto, @IsOptional()/@ValidateIf() no sirven porque ambos descartan el validador entero cuando la condición da falso. */
function IsValidChequeReference(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidChequeReference',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const line = args.object as ReciboCajaPaymentLineDto;
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
          const line = args.object as ReciboCajaPaymentLineDto;
          return line.method === EgresoPaymentMethod.cheque
            ? 'El número de cheque es obligatorio para este método de pago'
            : 'reference debe ser un texto de máximo 100 caracteres';
        },
      },
    });
  };
}

/** Abono a una cuenta por cobrar dentro del recibo de caja. */
export class ReciboCajaReceivableLineDto {
  @IsUUID()
  accountReceivableId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class ReciboCajaPaymentLineDto {
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

export class CreateReciboCajaDto {
  @IsUUID()
  clientId!: string;

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
}
