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

  const apply = (amount = 30000) =>
    applyCustomerCredits(tx as unknown as Prisma.TransactionClient, {
      customerId: 'c1',
      saleDocumentId: 'sale1',
      saleTotal: 100000,
      appliedCustomerCredits: [{ customerCreditId: 'cc1', amount }],
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

  it('aplica un saldo de facturación completo y queda usado', async () => {
    tx.customerCredit.findMany.mockResolvedValue([credit('facturacion')]);
    await apply(50000);
    expect(tx.customerCreditApplication.create).toHaveBeenCalledWith({
      data: { customerCreditId: 'cc1', saleDocumentId: 'sale1', amount: 50000 },
    });
    expect(tx.customerCredit.update).toHaveBeenCalledWith({
      where: { id: 'cc1' },
      data: { balance: 0, status: 'used' },
    });
  });
});

describe('applyCustomerCredits — completo o nada', () => {
  const tx = {
    $queryRaw: jest.fn(),
    customerCredit: { findMany: jest.fn(), update: jest.fn() },
    customerCreditApplication: { create: jest.fn() },
  };

  const apply = (amount: number, saleTotal = 100000) =>
    applyCustomerCredits(tx as unknown as Prisma.TransactionClient, {
      customerId: 'c1',
      saleDocumentId: 'sale1',
      saleTotal,
      appliedCustomerCredits: [{ customerCreditId: 'cc1', amount }],
    });

  beforeEach(() => {
    jest.resetAllMocks();
    tx.$queryRaw.mockResolvedValue([]);
    tx.customerCredit.findMany.mockResolvedValue([
      {
        id: 'cc1',
        customerId: 'c1',
        usableIn: 'facturacion',
        status: 'available',
        amount: new Prisma.Decimal(100000),
        balance: new Prisma.Decimal(40000),
      },
    ]);
  });

  it('rechaza usar una parte del saldo y no toca nada', async () => {
    await expect(apply(30000)).rejects.toThrow(
      'El saldo a favor se usa completo o no se usa. Saldo disponible: 40000.00',
    );
    expect(tx.customerCreditApplication.create).not.toHaveBeenCalled();
    expect(tx.customerCredit.update).not.toHaveBeenCalled();
  });

  it('rechaza un saldo mayor que la venta y no toca nada', async () => {
    await expect(apply(40000, 30000)).rejects.toThrow(
      'El saldo a favor aplicado no puede superar el total de la venta',
    );
    expect(tx.customerCreditApplication.create).not.toHaveBeenCalled();
    expect(tx.customerCredit.update).not.toHaveBeenCalled();
  });

  it('un saldo ya usado en parte se aplica por todo lo que le queda', async () => {
    await apply(40000);
    expect(tx.customerCreditApplication.create).toHaveBeenCalledWith({
      data: { customerCreditId: 'cc1', saleDocumentId: 'sale1', amount: 40000 },
    });
    expect(tx.customerCredit.update).toHaveBeenCalledWith({
      where: { id: 'cc1' },
      data: { balance: 0, status: 'used' },
    });
  });
});
