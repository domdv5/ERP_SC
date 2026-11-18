import { Prisma } from '@prisma/client';
import {
  calculateAvailableTotal,
  calculateUsed,
  deriveCreditStatus,
} from './credits.helpers';

const credit = (
  amount: number,
  balance: number,
  extra: { status?: string; voidedAt?: Date | null } = {},
) => ({
  amount: new Prisma.Decimal(amount),
  balance: new Prisma.Decimal(balance),
  status: extra.status ?? 'available',
  voidedAt: extra.voidedAt ?? null,
});

describe('deriveCreditStatus', () => {
  it('sin usar es available', () => {
    expect(deriveCreditStatus(credit(100, 100))).toBe('available');
  });

  it('usado en parte es partial', () => {
    expect(deriveCreditStatus(credit(100, 40))).toBe('partial');
  });

  it('balance 0 es used', () => {
    expect(deriveCreditStatus(credit(100, 0, { status: 'used' }))).toBe('used');
  });

  it('anulado gana aunque el balance sea igual al monto', () => {
    expect(deriveCreditStatus(credit(100, 100, { status: 'voided' }))).toBe(
      'voided',
    );
    expect(deriveCreditStatus(credit(100, 0, { voidedAt: new Date() }))).toBe(
      'voided',
    );
  });
});

describe('calculateUsed', () => {
  it('es monto menos balance, y 0 si está anulado', () => {
    expect(calculateUsed(credit(100, 30)).toString()).toBe('70');
    expect(
      calculateUsed(credit(100, 100, { status: 'voided' })).toString(),
    ).toBe('0');
  });
});

describe('calculateAvailableTotal', () => {
  it('excluye anulados y saldos en cero', () => {
    const total = calculateAvailableTotal([
      credit(100, 100),
      credit(50, 20),
      credit(80, 0, { status: 'used' }),
      credit(500, 500, { status: 'voided' }),
      credit(300, 300, { voidedAt: new Date() }),
    ]);
    expect(total.toString()).toBe('120');
  });
});
