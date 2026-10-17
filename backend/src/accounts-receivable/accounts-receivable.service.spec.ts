import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AccountsReceivableService } from './accounts-receivable.service';

const decimal = (value: string) => new Prisma.Decimal(value);

describe('AccountsReceivableService.getClientStatement', () => {
  const prisma = {
    customer: { findUnique: jest.fn() },
    accountsReceivable: { findMany: jest.fn() },
    customerCredit: { findMany: jest.fn() },
  };
  const service = new AccountsReceivableService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('lanza 404 si el cliente no existe', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.getClientStatement('x')).rejects.toThrow(
      new NotFoundException('Cliente no encontrado'),
    );
    expect(prisma.accountsReceivable.findMany).not.toHaveBeenCalled();
  });

  it('calcula totales y suma solo los créditos disponibles', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      thirdParty: { id: 'c1', name: 'Cliente Uno' },
    });
    prisma.accountsReceivable.findMany.mockResolvedValue([
      { id: 'a', totalAmount: decimal('100.10'), paidAmount: decimal('40') },
      { id: 'b', totalAmount: decimal('50'), paidAmount: decimal('50') },
    ]);
    prisma.customerCredit.findMany.mockResolvedValue([
      { id: 'k1', status: 'available', balance: decimal('30.5') },
      { id: 'k2', status: 'used', balance: decimal('0') },
      { id: 'k3', status: 'available', balance: decimal('9.5') },
    ]);

    const result = await service.getClientStatement('c1');

    expect(result.client).toEqual({ id: 'c1', name: 'Cliente Uno' });
    expect(result.totals.totalDebt.toString()).toBe('150.1');
    expect(result.totals.totalPaid.toString()).toBe('90');
    expect(result.totals.totalBalance.toString()).toBe('60.1');
    expect(result.totals.availableCredit.toString()).toBe('40');
    expect(result.receivables.map((r) => r.balance.toString())).toEqual([
      '60.1',
      '0',
    ]);
    expect(result.credits).toHaveLength(3);
  });
});
