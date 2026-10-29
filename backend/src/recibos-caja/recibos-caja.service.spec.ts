import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import type { JwtPayload } from '@/common/types';
import { RecibosCajaService } from './recibos-caja.service';
import { CreateReciboCajaDto } from './dto/create-recibo-caja.dto';

const CLIENT = 'c1';
const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';
const user = { sub: 'u1' } as JwtPayload;

const receivable = (id: string, branchId: string | null) => ({
  id,
  clientId: CLIENT,
  status: 'pending',
  totalAmount: new Prisma.Decimal(100),
  paidAmount: new Prisma.Decimal(0),
  document: { number: `F-${id}`, customerBranchId: branchId },
});

const buildDto = (
  receivableId: string,
  customerBranchId?: string,
): CreateReciboCajaDto =>
  ({
    clientId: CLIENT,
    customerBranchId,
    idempotencyKey: 'key',
    receivables: [{ accountReceivableId: receivableId, amount: 100 }],
    payments: [{ method: 'efectivo_oficina', amount: 100 }],
  }) as CreateReciboCajaDto;

describe('RecibosCajaService', () => {
  const tx = {
    customer: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
    reciboCaja: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    accountsReceivable: { findMany: jest.fn(), update: jest.fn() },
    customerBranch: { findFirst: jest.fn() },
    reciboCajaPayment: { createMany: jest.fn() },
    reciboCajaAllocation: { create: jest.fn() },
  };
  const prisma = {
    reciboCaja: { findUnique: jest.fn() },
    accountsReceivable: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const sequence = { next: jest.fn() };
  const service = new RecibosCajaService(
    prisma as unknown as PrismaService,
    sequence as unknown as SequenceService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.reciboCaja.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.customer.findUnique.mockResolvedValue({
      id: CLIENT,
      thirdParty: { isCustomer: true },
    });
    tx.$queryRaw.mockResolvedValue([]);
    tx.reciboCaja.findUnique.mockResolvedValue(null);
    tx.reciboCaja.create.mockResolvedValue({ id: 'r1' });
    tx.reciboCaja.findUniqueOrThrow.mockResolvedValue({ id: 'r1' });
    tx.customerBranch.findFirst.mockResolvedValue({ id: BRANCH_A });
    sequence.next.mockResolvedValue('000001');
  });

  const mockReceivable = (branchId: string | null) =>
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable('ar1', branchId),
    ]);

  describe('create — sucursal', () => {
    it('rechaza recibo sin sucursal si la CxC tiene sucursal', async () => {
      mockReceivable(BRANCH_A);
      await expect(service.create(buildDto('ar1'), user)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.reciboCaja.create).not.toHaveBeenCalled();
    });

    it('rechaza una CxC de otra sucursal', async () => {
      mockReceivable(BRANCH_B);
      await expect(
        service.create(buildDto('ar1', BRANCH_A), user),
      ).rejects.toThrow('no pertenece a la sucursal seleccionada');
    });

    it('rechaza una sucursal de otro cliente', async () => {
      mockReceivable(BRANCH_A);
      tx.customerBranch.findFirst.mockResolvedValue(null);
      await expect(
        service.create(buildDto('ar1', BRANCH_A), user),
      ).rejects.toThrow('La sucursal no pertenece al cliente');
    });

    it('acepta recibo sin sucursal para una CxC sin sucursal', async () => {
      mockReceivable(null);
      await service.create(buildDto('ar1'), user);
      expect(tx.reciboCaja.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ customerBranchId: null }),
      });
    });

    it('guarda customerBranchId cuando coincide con la CxC', async () => {
      mockReceivable(BRANCH_A);
      await service.create(buildDto('ar1', BRANCH_A), user);
      expect(tx.reciboCaja.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ customerBranchId: BRANCH_A }),
      });
    });

    it('idempotencia: misma clave con otra sucursal es 409', async () => {
      prisma.reciboCaja.findUnique.mockResolvedValue({
        clientId: CLIENT,
        customerBranchId: BRANCH_B,
        total: new Prisma.Decimal(100),
        allocations: [
          { accountReceivableId: 'ar1', amount: new Prisma.Decimal(100) },
        ],
      });
      await expect(
        service.create(buildDto('ar1', BRANCH_A), user),
      ).rejects.toThrow('clave de idempotencia');
    });
  });

  describe('findOpenItems', () => {
    const whereOf = () =>
      (
        prisma.accountsReceivable.findMany.mock.calls[0] as [
          { where: Prisma.AccountsReceivableWhereInput },
        ]
      )[0].where;

    beforeEach(() => prisma.accountsReceivable.findMany.mockResolvedValue([]));

    it('sin parámetro no filtra por sucursal', async () => {
      await service.findOpenItems(CLIENT);
      expect(whereOf()).not.toHaveProperty('document');
    });

    it('filtra por la sucursal indicada', async () => {
      await service.findOpenItems(CLIENT, BRANCH_A);
      expect(whereOf().document).toEqual({ customerBranchId: BRANCH_A });
    });

    it('"none" filtra las CxC sin sucursal', async () => {
      await service.findOpenItems(CLIENT, 'none');
      expect(whereOf().document).toEqual({ customerBranchId: null });
    });
  });
});
