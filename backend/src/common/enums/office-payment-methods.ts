import { TreasuryPaymentMethod } from '@prisma/client';

// Únicas formas aceptadas al crear recibos y egresos; los registros históricos pueden tener las otras.
export const OFFICE_PAYMENT_METHODS = [
  TreasuryPaymentMethod.efectivo_oficina,
  TreasuryPaymentMethod.consignacion_oficina,
];
