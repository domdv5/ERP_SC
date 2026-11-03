import { Prisma } from '@prisma/client';
import { applyCustomerCredits } from './customer-credit.helpers';

describe('applyCustomerCredits — tipo de saldo', () => {
  const tx = {
    $queryRaw: jest.fn(),
    customerCredit: { findMany: jest.fn(), update: jest.fn() },
    customerCreditApplication: { create: jest.fn() },
  };

  const credit = (usableIn: 'facturacion' | 'administracion') => ({
    id: 'cc1',
    customerId: 'c1',
    usableIn,
    status: 'available',
    balance: new Prisma.Decimal(50000),
  });

  const apply = () =>
    applyCustomerCredits(tx as unknown as Prisma.TransactionClient, {
      customerId: 'c1',
      saleDocumentId: 'sale1',
      saleTotal: 100000,
      appliedCustomerCredits: [{ customerCreditId: 'cc1', amount: 30000 }],
    });

  beforeEach(() => {
    jest.resetAllMocks();
    tx.$queryRaw.mockResolvedValue([]);
  });

  it('rechaza un saldo de administración al facturar y no toca el saldo', async () => {
    tx.customerCredit.findMany.mockResolvedValue([credit('administracion')]);
    await expect(apply()).rejects.toThrow(
      'Este saldo a favor es de administración: solo se usa en recibos de caja',
    );
    expect(tx.customerCreditApplication.create).not.toHaveBeenCalled();
    expect(tx.customerCredit.update).not.toHaveBeenCalled();
  });

  it('aplica un saldo de facturación', async () => {
    tx.customerCredit.findMany.mockResolvedValue([credit('facturacion')]);
    await apply();
    expect(tx.customerCreditApplication.create).toHaveBeenCalledWith({
      data: { customerCreditId: 'cc1', saleDocumentId: 'sale1', amount: 30000 },
    });
    expect(tx.customerCredit.update).toHaveBeenCalledWith({
      where: { id: 'cc1' },
      data: { balance: 20000, status: 'available' },
    });
  });
});
