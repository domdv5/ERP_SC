import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';
import {
  assertCreditWithinLimit,
  getCreditLimitSummary,
} from './credit.helpers';

const receivable = (totalAmount: number, paidAmount: number) => ({
  totalAmount: new Prisma.Decimal(totalAmount),
  paidAmount: new Prisma.Decimal(paidAmount),
});

const buildClient = (
  creditLimit: number | null,
  openAccounts: ReturnType<typeof receivable>[],
) => {
  const findMany = jest.fn().mockResolvedValue(openAccounts);
  const client = {
    customer: {
      findUnique: jest.fn().mockResolvedValue({
        creditLimit:
          creditLimit === null ? null : new Prisma.Decimal(creditLimit),
      }),
    },
    accountsReceivable: { findMany },
  } as unknown as PrismaService;
  return { client, findMany };
};

describe('getCreditLimitSummary', () => {
  it('descuenta los abonos hechos con recibo de caja (paidAmount)', async () => {
    const { client } = buildClient(1000000, [receivable(500000, 200000)]);

    const summary = await getCreditLimitSummary(client, 'customer-1');

    expect(summary).toEqual({
      creditLimit: 1000000,
      usedCredit: 300000,
      availableCredit: 700000,
    });
  });

  it('sin abonos, el cupo usado es el total de las CxC abiertas', async () => {
    const { client } = buildClient(1000000, [
      receivable(500000, 0),
      receivable(100000, 0),
    ]);

    const summary = await getCreditLimitSummary(client, 'customer-1');

    expect(summary.usedCredit).toBe(600000);
    expect(summary.availableCredit).toBe(400000);
  });

  it('solo cuenta CxC pendientes o con abono parcial (las pagadas no usan cupo)', async () => {
    const { client, findMany } = buildClient(1000000, []);

    await getCreditLimitSummary(client, 'customer-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: 'customer-1',
          status: { in: ['pending', 'partial'] },
        },
      }),
    );
  });

  it('sin cupo en la ficha del cliente, el cupo es 0', async () => {
    const { client } = buildClient(null, []);

    const summary = await getCreditLimitSummary(client, 'customer-1');

    expect(summary).toEqual({
      creditLimit: 0,
      usedCredit: 0,
      availableCredit: 0,
    });
  });
});

describe('assertCreditWithinLimit', () => {
  it('deja pasar lo que entra en el cupo liberado por un abono', async () => {
    const { client } = buildClient(600000, [receivable(500000, 200000)]);

    await expect(
      assertCreditWithinLimit(client, 'customer-1', 300000),
    ).resolves.toBeUndefined();
  });

  it('rechaza con 400 y el detalle del cupo si se pasa', async () => {
    const { client } = buildClient(600000, [receivable(500000, 200000)]);

    const error = await assertCreditWithinLimit(
      client,
      'customer-1',
      300001,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      message:
        'La venta a crédito supera el cupo disponible del cliente. Para realizarla, ' +
        'el cupo de crédito debe aumentarse (requiere autorización).',
      credit: {
        creditLimit: 600000,
        usedCredit: 300000,
        availableCredit: 300000,
        requested: 300001,
      },
    });
  });
});
