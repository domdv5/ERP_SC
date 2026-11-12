import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';
import { toCents } from '@/common/utils/money.util';

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

export interface CreditLimitSummary {
  /** Todos en pesos. `creditLimit` null en la ficha del cliente ⇒ 0. */
  creditLimit: number;
  usedCredit: number;
  availableCredit: number;
}

/** Cupo de crédito del cliente: `usedCredit` es el saldo (`totalAmount − paidAmount`) de sus CxC abiertas; `creditLimit` null ⇒ cupo 0. */
export async function getCreditLimitSummary(
  client: PrismaOrTx,
  customerId: string,
): Promise<CreditLimitSummary> {
  const summaries = await getCreditLimitSummaries(client, [customerId]);
  return summaries.get(customerId)!;
}

/** Cupo de varios clientes en dos consultas; la COT y la lista de terceros usan esta misma cuenta. */
export async function getCreditLimitSummaries(
  client: PrismaOrTx,
  customerIds: string[],
): Promise<Map<string, CreditLimitSummary>> {
  const summaries = new Map<string, CreditLimitSummary>();
  if (customerIds.length === 0) return summaries;

  const [customers, openAccounts] = await Promise.all([
    client.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, creditLimit: true },
    }),
    client.accountsReceivable.findMany({
      where: {
        clientId: { in: customerIds },
        status: { in: ['pending', 'partial'] },
      },
      select: { clientId: true, totalAmount: true, paidAmount: true },
    }),
  ]);

  const limitCentsById = new Map(
    customers.map((customer) => [
      customer.id,
      customer.creditLimit ? toCents(customer.creditLimit) : 0,
    ]),
  );

  // paidAmount suma los abonos de recibos de caja: es el mismo saldo que muestran CxC y el recibo.
  const usedCentsById = new Map<string, number>();
  for (const account of openAccounts) {
    const balanceCents =
      toCents(account.totalAmount) - toCents(account.paidAmount);
    usedCentsById.set(
      account.clientId,
      (usedCentsById.get(account.clientId) ?? 0) + balanceCents,
    );
  }

  for (const customerId of customerIds) {
    const creditLimitCents = limitCentsById.get(customerId) ?? 0;
    const usedCreditCents = usedCentsById.get(customerId) ?? 0;
    summaries.set(customerId, {
      creditLimit: creditLimitCents / 100,
      usedCredit: usedCreditCents / 100,
      availableCredit: (creditLimitCents - usedCreditCents) / 100,
    });
  }

  return summaries;
}

/** Bloqueo duro: si `requestedTotal` supera el cupo disponible, lanza 400 con el detalle del cupo (`credit` viaja junto a `message`). */
export async function assertCreditWithinLimit(
  client: PrismaOrTx,
  customerId: string,
  requestedTotal: number,
): Promise<void> {
  const summary = await getCreditLimitSummary(client, customerId);

  if (toCents(requestedTotal) > toCents(summary.availableCredit)) {
    throw new BadRequestException({
      message:
        'La venta a crédito supera el cupo disponible del cliente. Para realizarla, ' +
        'el cupo de crédito debe aumentarse (requiere autorización).',
      credit: { ...summary, requested: requestedTotal },
    });
  }
}
