import { Prisma } from '@prisma/client';
import type { CreditStatus } from '@/contracts/credits';

interface CreditAmounts {
  amount: Prisma.Decimal;
  balance: Prisma.Decimal;
  status: string;
  voidedAt?: Date | null;
}

export function isVoidedCredit(credit: CreditAmounts): boolean {
  return credit.status === 'voided' || !!credit.voidedAt;
}

/** Anulado gana sobre todo; disponible = sin usar; usado = balance 0; el resto es parcial. */
export function deriveCreditStatus(credit: CreditAmounts): CreditStatus {
  if (isVoidedCredit(credit)) return 'voided';
  if (credit.balance.equals(credit.amount)) return 'available';
  if (credit.balance.lte(0)) return 'used';
  return 'partial';
}

/** Lo usado de un saldo anulado es 0: nunca llegó a gastarse. */
export function calculateUsed(credit: CreditAmounts): Prisma.Decimal {
  return isVoidedCredit(credit)
    ? new Prisma.Decimal(0)
    : credit.amount.minus(credit.balance);
}

/** Solo suma saldos no anulados con balance > 0. */
export function calculateAvailableTotal(credits: CreditAmounts[]) {
  return credits
    .filter((credit) => !isVoidedCredit(credit) && credit.balance.gt(0))
    .reduce((sum, credit) => sum.plus(credit.balance), new Prisma.Decimal(0));
}

export function buildSearchFilter(search?: string) {
  const text = search?.trim();
  if (!text) return undefined;
  return {
    OR: [
      { name: { contains: text, mode: 'insensitive' } },
      { documentNumber: { contains: text, mode: 'insensitive' } },
    ],
  } satisfies Prisma.ThirdPartyWhereInput;
}
