import { Prisma } from '@prisma/client';

/** Convierte a centavos enteros para comparar/operar montos sin errores de coma flotante. */
export function toCents(amount: number | Prisma.Decimal): number {
  return Math.round(Number(amount) * 100);
}
