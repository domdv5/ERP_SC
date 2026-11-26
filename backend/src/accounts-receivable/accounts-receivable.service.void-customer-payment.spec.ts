import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AccountsReceivableService } from './accounts-receivable.service';

const ONLY_ACTIVE_ALLOCATION = { customerPayment: { voidedAt: null } };
const ONLY_ACTIVE_APPLICATION = {
  OR: [{ customerPaymentId: null }, { customerPayment: { voidedAt: null } }],
};

describe('AccountsReceivableService: recibos anulados no cuentan', () => {
  const prisma = {
    customer: { findUnique: jest.fn() },
    accountsReceivable: { findMany: jest.fn(), findUnique: jest.fn() },
    customerCredit: { findMany: jest.fn() },
    customerBranch: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const service = new AccountsReceivableService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );
    prisma.customerBranch.findMany.mockResolvedValue([]);
  });

  it('el estado de cuenta ignora abonos y saldos usados de recibos anulados', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      thirdParty: { id: 'c1', name: 'Cliente' },
    });
    prisma.accountsReceivable.findMany.mockResolvedValue([]);
    prisma.customerCredit.findMany.mockResolvedValue([]);

    await service.getClientStatement('c1');

    const receivablesQuery =
      prisma.accountsReceivable.findMany.mock.calls[0][0];
    expect(receivablesQuery.include.customerPaymentAllocations.where).toEqual(
      ONLY_ACTIVE_ALLOCATION,
    );
    const creditsQuery = prisma.customerCredit.findMany.mock.calls[0][0];
    expect(creditsQuery.include.applications.where).toEqual(
      ONLY_ACTIVE_APPLICATION,
    );
  });

  it('el historial del detalle y el listado ignoran abonos de recibos anulados', async () => {
    prisma.accountsReceivable.findUnique.mockResolvedValue({
      id: 'a1',
      totalAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(0),
      customerPaymentAllocations: [],
    });

    await service.findOne('a1');

    const detailQuery = prisma.accountsReceivable.findUnique.mock.calls[0][0];
    expect(detailQuery.include.customerPaymentAllocations.where).toEqual(
      ONLY_ACTIVE_ALLOCATION,
    );
  });

  it('la fecha del último pago por cliente solo toma recibos no anulados', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { client_count: 0, total_amount: 0, paid_amount: 0 },
      ]);

    await service.findClients({});

    const sql = prisma.$queryRaw.mock.calls
      .map((call: unknown[]) =>
        Prisma.sql(
          call[0] as TemplateStringsArray,
          ...call.slice(1),
        ).sql.replace(/\s+/g, ' '),
      )
      .join(' ');
    expect(sql).toContain('WHERE payment.voided_at IS NULL');
  });
});
