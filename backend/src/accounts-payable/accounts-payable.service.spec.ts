import { PrismaService } from '@/prisma/prisma.service';
import { AccountsPayableService } from './accounts-payable.service';

describe('AccountsPayableService: orden de las CxP', () => {
  const prisma = {
    supplier: { findUnique: jest.fn() },
    accountsPayable: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    supplierCredit: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AccountsPayableService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.accountsPayable.findMany.mockResolvedValue([]);
    prisma.supplierCredit.findMany.mockResolvedValue([]);
  });

  it('el listado ordena por último movimiento (compra o abono), el más reciente primero', async () => {
    prisma.$transaction.mockResolvedValue([
      [],
      0,
      { _sum: { totalAmount: null, paidAmount: null } },
    ]);

    await service.findAll({});

    expect(prisma.accountsPayable.findMany.mock.calls[0][0].orderBy).toEqual([
      { updatedAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('el estado de cuenta ordena por último movimiento, el más reciente primero', async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      id: 's1',
      thirdParty: { id: 's1', name: 'Proveedor' },
    });

    await service.getSupplierStatement('s1');

    expect(prisma.accountsPayable.findMany.mock.calls[0][0].orderBy).toEqual([
      { updatedAt: 'desc' },
      { id: 'desc' },
    ]);
  });
});
