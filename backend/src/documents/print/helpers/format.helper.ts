import { Prisma } from '@prisma/client';

/** Mismo formato de moneda que se usa en el frontend. */
export function formatCOP(value: Prisma.Decimal | number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(value));
}
