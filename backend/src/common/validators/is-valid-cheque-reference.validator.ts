import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { EgresoPaymentMethod } from '@prisma/client';

interface PaymentLineWithMethod {
  method: EgresoPaymentMethod;
}

/** Valida `reference`: opcional salvo si `method === 'cheque'` — @IsOptional()/@ValidateIf() no sirven porque ambos descartan el validador entero cuando la condición da falso. */
export function IsValidChequeReference(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidChequeReference',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const line = args.object as PaymentLineWithMethod;
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
          const line = args.object as PaymentLineWithMethod;
          return line.method === EgresoPaymentMethod.cheque
            ? 'El número de cheque es obligatorio para este método de pago'
            : 'reference debe ser un texto de máximo 100 caracteres';
        },
      },
    });
  };
}
