import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import { ExcedentesService } from './excedentes.service';

const CLIENT = 'c1';
const BRANCH = 'b1';
const user = { sub: 'u1' } as JwtPayload;

describe('ExcedentesService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    customerCredit: { findUnique: jest.fn(), update: jest.fn() },
    customerCreditApplication: { count: jest.fn() },
  };
  const prisma = {
    customer: { findUnique: jest.fn() },
    customerBranch: { findFirst: jest.fn() },
    customerCredit: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ExcedentesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.customer.findUnique.mockResolvedValue({
      id: CLIENT,
      thirdParty: { isCustomer: true },
    });
    prisma.customerBranch.findFirst.mockResolvedValue({ id: BRANCH });
    prisma.customerCredit.create.mockResolvedValue({ id: 'cc1' });
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.customerCreditApplication.count.mockResolvedValue(0);
  });

  describe('create', () => {
    it('registra el excedente con sucursal, fecha y usuario', async () => {
      await service.create(
        CLIENT,
        { customerBranchId: BRANCH, amount: 7000000, date: '2026-10-29' },
        user,
      );
      expect(prisma.customerCredit.create).toHaveBeenCalledWith({
        data: {
          customerId: CLIENT,
          kind: 'excedente',
          customerBranchId: BRANCH,
          amount: 7000000,
          balance: 7000000,
          status: 'available',
          date: new Date('2026-10-29'),
          userId: 'u1',
        },
      });
    });

    it('sin sucursal guarda customerBranchId null', async () => {
      await service.create(CLIENT, { amount: 1000, date: '2026-10-29' }, user);
      expect(prisma.customerCredit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ customerBranchId: null }),
      });
      expect(prisma.customerBranch.findFirst).not.toHaveBeenCalled();
    });

    it('rechaza una sucursal de otro cliente', async () => {
      prisma.customerBranch.findFirst.mockResolvedValue(null);
      await expect(
        service.create(
          CLIENT,
          { customerBranchId: 'otra', amount: 1000, date: '2026-10-29' },
          user,
        ),
      ).rejects.toThrow('La sucursal no pertenece al cliente');
      expect(prisma.customerCredit.create).not.toHaveBeenCalled();
    });

    it('rechaza un tercero que no es cliente', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create(CLIENT, { amount: 1000, date: '2026-10-29' }, user),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customerCredit.create).not.toHaveBeenCalled();
    });

    it('rechaza fecha futura', async () => {
      await expect(
        service.create(CLIENT, { amount: 1000, date: '2999-01-01' }, user),
      ).rejects.toThrow('La fecha del excedente no puede ser futura');
      expect(prisma.customerCredit.create).not.toHaveBeenCalled();
    });
  });

  describe('void', () => {
    const excedente = (overrides: object = {}) => ({
      id: 'cc1',
      kind: 'excedente',
      status: 'available',
      amount: new Prisma.Decimal(10000000),
      balance: new Prisma.Decimal(10000000),
      ...overrides,
    });

    it('anula un excedente sin usar: queda voided con quién y cuándo', async () => {
      tx.customerCredit.findUnique.mockResolvedValue(excedente());
      await service.void('cc1', user);
      expect(tx.customerCredit.update).toHaveBeenCalledWith({
        where: { id: 'cc1' },
        data: {
          status: 'voided',
          balance: 0,
          voidedAt: expect.any(Date),
          voidedById: 'u1',
        },
      });
    });

    it('rechaza anular un excedente ya usado', async () => {
      tx.customerCredit.findUnique.mockResolvedValue(
        excedente({ balance: new Prisma.Decimal(4000000) }),
      );
      tx.customerCreditApplication.count.mockResolvedValue(1);
      await expect(service.void('cc1', user)).rejects.toThrow(
        'El excedente ya se usó en un recibo de caja y no se puede anular',
      );
      expect(tx.customerCredit.update).not.toHaveBeenCalled();
    });

    it('rechaza anular un saldo de devolución', async () => {
      tx.customerCredit.findUnique.mockResolvedValue(
        excedente({ kind: 'devolucion' }),
      );
      await expect(service.void('cc1', user)).rejects.toThrow(
        'Solo se pueden anular excedentes',
      );
      expect(tx.customerCredit.update).not.toHaveBeenCalled();
    });

    it('rechaza anular dos veces', async () => {
      tx.customerCredit.findUnique.mockResolvedValue(
        excedente({ status: 'voided' }),
      );
      await expect(service.void('cc1', user)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.customerCredit.update).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      tx.customerCredit.findUnique.mockResolvedValue(null);
      await expect(service.void('cc1', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
