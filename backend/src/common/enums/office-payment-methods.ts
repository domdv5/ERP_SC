import { EgresoPaymentMethod } from '@prisma/client';

// Únicas formas aceptadas al crear recibos y egresos; los registros históricos pueden tener las otras.
export const OFFICE_PAYMENT_METHODS = [
  EgresoPaymentMethod.efectivo_oficina,
  EgresoPaymentMethod.consignacion_oficina,
];
