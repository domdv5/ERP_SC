import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Compara montos en centavos enteros para evitar errores de coma flotante. */
function toCents(amount: number | Prisma.Decimal) {
  return Math.round(Number(amount) * 100);
}

export interface ApplyCustomerCreditsParams {
  /** Cliente de la venta — debe coincidir con el dueño de cada saldo a favor. */
  customerId: string;
  /** Documento de venta (POS/COT) al que se imputa la aplicación. */
  saleDocumentId: string;
  /** Total bruto de la venta: techo de la suma aplicable. */
  saleTotal: number | Prisma.Decimal;
  /** Saldos a favor citados en el body de confirm, con el monto de cada uno. */
  appliedCustomerCredits: { customerCreditId: string; amount: number }[];
}

/**
 * Aplica uno o más saldos a favor del cliente contra una venta. Espeja
 * AccountsPayableService.registerPayment: agrupa por crédito, bloquea las filas
 * en orden por id (SELECT ... FOR UPDATE) para no pisarse con otra venta
 * concurrente, valida en centavos y descuenta el balance. El backend solo impone
 * el techo (cada aplicación <= balance del crédito, y la suma <= total de la venta);
 * cuánto aplicar lo decide el frontend.
 */
export async function applyCustomerCredits(
  tx: Prisma.TransactionClient,
  params: ApplyCustomerCreditsParams,
): Promise<void> {
  const { customerId, saleDocumentId, saleTotal, appliedCustomerCredits } =
    params;

  if (!appliedCustomerCredits || appliedCustomerCredits.length === 0) {
    return;
  }

  // Agrupa por crédito: si el mismo aparece dos veces, validar cada línea suelta
  // dejaría pasar una sobre-aplicación que solo se ve al sumarlas.
  const requestedCentsByCreditId = new Map<string, number>();
  for (const application of appliedCustomerCredits) {
    const previous =
      requestedCentsByCreditId.get(application.customerCreditId) ?? 0;
    requestedCentsByCreditId.set(
      application.customerCreditId,
      previous + toCents(application.amount),
    );
  }

  const totalRequestedCents = [...requestedCentsByCreditId.values()].reduce(
    (sum, cents) => sum + cents,
    0,
  );

  if (totalRequestedCents <= 0) {
    return;
  }

  if (totalRequestedCents > toCents(saleTotal)) {
    throw new BadRequestException(
      'El saldo a favor aplicado no puede superar el total de la venta',
    );
  }

  const creditIds = [...requestedCentsByCreditId.keys()];

  // Bloqueo ordenado por id, siempre en el mismo orden, para no trabarse con
  // otra transacción en paralelo. Orden global del flujo de venta:
  // customers -> customer_credit -> accounts_receivable.
  await tx.$queryRaw`SELECT id FROM "customer_credit" WHERE id = ANY(${creditIds}::uuid[]) ORDER BY id FOR UPDATE`;

  const credits = await tx.customerCredit.findMany({
    where: { id: { in: creditIds } },
  });

  if (credits.length !== creditIds.length) {
    throw new BadRequestException(
      'Alguna nota de saldo a favor citada no existe',
    );
  }

  for (const credit of credits) {
    if (credit.customerId !== customerId) {
      throw new BadRequestException(
        'El saldo a favor citado no pertenece a este cliente',
      );
    }

    if (credit.status !== 'available' || toCents(credit.balance) <= 0) {
      throw new BadRequestException('El saldo a favor citado ya fue utilizado');
    }

    const requestedCents = requestedCentsByCreditId.get(credit.id)!;
    if (requestedCents > toCents(credit.balance)) {
      throw new BadRequestException(
        `El monto aplicado del saldo a favor excede su saldo disponible: ${Number(
          credit.balance,
        ).toFixed(2)}`,
      );
    }
  }

  for (const [customerCreditId, requestedCents] of requestedCentsByCreditId) {
    await tx.customerCreditApplication.create({
      data: {
        customerCreditId,
        saleDocumentId,
        amount: requestedCents / 100,
      },
    });

    const credit = credits.find((c) => c.id === customerCreditId)!;
    const newBalanceCents = toCents(credit.balance) - requestedCents;

    await tx.customerCredit.update({
      where: { id: customerCreditId },
      data: {
        balance: newBalanceCents / 100,
        status: newBalanceCents <= 0 ? 'used' : 'available',
      },
    });
  }
}

/**
 * Deshace las aplicaciones de saldo a favor hechas al confirmar una venta que
 * ahora se anula: restaura el balance de cada crédito, lo vuelve a 'available' y
 * borra las filas de aplicación. Suma en centavos y bloquea los créditos en
 * orden por id, igual que applyCustomerCredits.
 */
export async function revertCustomerCreditApplications(
  tx: Prisma.TransactionClient,
  saleDocumentId: string,
): Promise<void> {
  const applications = await tx.customerCreditApplication.findMany({
    where: { saleDocumentId },
  });

  if (applications.length === 0) {
    return;
  }

  const restoredCentsByCreditId = new Map<string, number>();
  for (const application of applications) {
    const previous =
      restoredCentsByCreditId.get(application.customerCreditId) ?? 0;
    restoredCentsByCreditId.set(
      application.customerCreditId,
      previous + toCents(application.amount),
    );
  }

  const creditIds = [...restoredCentsByCreditId.keys()].sort();
  await tx.$queryRaw`SELECT id FROM "customer_credit" WHERE id = ANY(${creditIds}::uuid[]) ORDER BY id FOR UPDATE`;

  const credits = await tx.customerCredit.findMany({
    where: { id: { in: creditIds } },
  });

  for (const credit of credits) {
    const restoredCents = restoredCentsByCreditId.get(credit.id) ?? 0;
    const newBalanceCents = toCents(credit.balance) + restoredCents;

    await tx.customerCredit.update({
      where: { id: credit.id },
      data: {
        balance: newBalanceCents / 100,
        status: newBalanceCents > 0 ? 'available' : 'used',
      },
    });
  }

  await tx.customerCreditApplication.deleteMany({ where: { saleDocumentId } });
}
