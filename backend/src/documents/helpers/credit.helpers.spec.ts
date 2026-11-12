import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';
import {
  assertCreditWithinLimit,
  getCreditLimitSummaries,
  getCreditLimitSummary,
} from './credit.helpers';

const receivable = (
  totalAmount: number,
  paidAmount: number,
  clientId = 'customer-1',
) => ({
  clientId,
  totalAmount: new Prisma.Decimal(totalAmount),
  paidAmount: new Prisma.Decimal(paidAmount),
});

const buildClientWithCustomers = (
  limits: Record<string, number | null>,
  openAccounts: ReturnType<typeof receivable>[],
) => {
  const findMany = jest.fn().mockResolvedValue(openAccounts);
  const customerFindMany = jest.fn().mockResolvedValue(
    Object.entries(limits).map(([id, limit]) => ({
      id,
      creditLimit: limit === null ? null : new Prisma.Decimal(limit),
    })),
  );
  const client = {
    customer: { findMany: customerFindMany },
    accountsReceivable: { findMany },
  } as unknown as PrismaService;
  return { client, findMany, customerFindMany };
};

const buildClient = (
  creditLimit: number | null,
  openAccounts: ReturnType<typeof receivable>[],
) => buildClientWithCustomers({ 'customer-1': creditLimit }, openAccounts);

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
          clientId: { in: ['customer-1'] },
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

describe('getCreditLimitSummaries', () => {
  it('separa el cupo usado de cada cliente', async () => {
    const { client } = buildClientWithCustomers(
      { 'customer-1': 1000000, 'customer-2': 300000 },
      [
        receivable(500000, 200000, 'customer-1'),
        receivable(100000, 0, 'customer-1'),
        receivable(250000, 50000, 'customer-2'),
      ],
    );

    const summaries = await getCreditLimitSummaries(client, [
      'customer-1',
      'customer-2',
    ]);

    expect(summaries.get('customer-1')).toEqual({
      creditLimit: 1000000,
      usedCredit: 400000,
      availableCredit: 600000,
    });
    expect(summaries.get('customer-2')).toEqual({
      creditLimit: 300000,
      usedCredit: 200000,
      availableCredit: 100000,
    });
  });

  it('cliente sin CxC abiertas: usado 0 y disponible = cupo', async () => {
    const { client } = buildClientWithCustomers({ 'customer-3': 500000 }, []);

    const summaries = await getCreditLimitSummaries(client, ['customer-3']);

    expect(summaries.get('customer-3')).toEqual({
      creditLimit: 500000,
      usedCredit: 0,
      availableCredit: 500000,
    });
  });

  it('sin clientes no consulta la base', async () => {
    const { client, findMany, customerFindMany } = buildClientWithCustomers(
      {},
      [],
    );

    const summaries = await getCreditLimitSummaries(client, []);

    expect(summaries.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(customerFindMany).not.toHaveBeenCalled();
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
