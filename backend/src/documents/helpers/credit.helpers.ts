import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/** Compara montos en centavos enteros para evitar errores de punto flotante (mismo patrón que accounts-receivable.service.ts). */
function toCents(amount: number | Prisma.Decimal) {
  return Math.round(Number(amount) * 100);
}

export interface CustomerCreditSummary {
  /** Todos en pesos. `creditLimit` null en la ficha del cliente ⇒ 0. */
  creditLimit: number;
  usedCredit: number;
  availableCredit: number;
}

/**
 * Cupo de crédito del cliente. `usedCredit` = saldo pendiente de sus cuentas por
 * cobrar abiertas (`total − Σ pagos`), sumado en centavos sobre las CxC en
 * `pending`/`partial`. `Customer.creditLimit` null ⇒ cupo 0: un cliente sin
 * línea de crédito no puede comprar a crédito.
 */
export async function getCustomerCreditSummary(
  client: PrismaOrTx,
  customerId: string,
): Promise<CustomerCreditSummary> {
  const [customer, openAccounts] = await Promise.all([
    client.customer.findUnique({
      where: { id: customerId },
      select: { creditLimit: true },
    }),
    client.accountsReceivable.findMany({
      where: { clientId: customerId, status: { in: ['pending', 'partial'] } },
      select: {
        totalAmount: true,
        receivablePayments: { select: { amount: true } },
      },
    }),
  ]);

  const creditLimitCents = customer?.creditLimit
    ? toCents(customer.creditLimit)
    : 0;

  const usedCreditCents = openAccounts.reduce((sum, account) => {
    const paidCents = account.receivablePayments.reduce(
      (paid, payment) => paid + toCents(payment.amount),
      0,
    );
    return sum + (toCents(account.totalAmount) - paidCents);
  }, 0);

  return {
    creditLimit: creditLimitCents / 100,
    usedCredit: usedCreditCents / 100,
    availableCredit: (creditLimitCents - usedCreditCents) / 100,
  };
}

/**
 * Bloqueo duro: si `requestedTotal` supera el cupo disponible, lanza 400 con el
 * detalle del cupo. `credit` viaja como hermano de `message` en el body HTTP
 * (mismo gotcha que `shortfalls` en el 409 de stock) — no hay override en la
 * venta; se resuelve subiendo `Customer.creditLimit` desde la ficha del cliente.
 */
export async function assertCreditWithinLimit(
  client: PrismaOrTx,
  customerId: string,
  requestedTotal: number,
): Promise<void> {
  const summary = await getCustomerCreditSummary(client, customerId);

  if (toCents(requestedTotal) > toCents(summary.availableCredit)) {
    throw new BadRequestException({
      message:
        'La venta a crédito supera el cupo disponible del cliente. Para realizarla, ' +
        'el cupo de crédito debe aumentarse (requiere autorización).',
      credit: { ...summary, requested: requestedTotal },
    });
  }
}
