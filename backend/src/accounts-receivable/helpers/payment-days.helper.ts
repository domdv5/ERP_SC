import type { AccountsReceivableStatus } from '@prisma/client';

const DAY_MS = 86_400_000;

export function findLastPaymentDate(paymentDates: Date[]): Date | null {
  if (paymentDates.length === 0) return null;
  return new Date(Math.max(...paymentDates.map((date) => date.getTime())));
}

/** Pagada: días de la venta al último pago. Abierta (pendiente o parcial): días de la venta a hoy, en curso. */
export function calculatePaymentDays(
  saleDate: Date,
  lastPaymentDate: Date | null,
  status: AccountsReceivableStatus,
  today: Date,
) {
  const isOpen = status !== 'paid';
  // Pagada sin pagos registrados = saldada con saldo a favor al vender: 0 días.
  const endDate = isOpen ? today : (lastPaymentDate ?? saleDate);
  return {
    days: Math.round((endDate.getTime() - saleDate.getTime()) / DAY_MS),
    isOpen,
  };
}
