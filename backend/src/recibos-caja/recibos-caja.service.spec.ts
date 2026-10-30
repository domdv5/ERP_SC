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

const receivable = (id: string, branchId: string | null, total = 100) => ({
  id,
  clientId: CLIENT,
  status: 'pending',
  totalAmount: new Prisma.Decimal(total),
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
        discountAmount: new Prisma.Decimal(0),
        discountReason: null,
        allocations: [
          { accountReceivableId: 'ar1', amount: new Prisma.Decimal(100) },
        ],
      });
      await expect(
        service.create(buildDto('ar1', BRANCH_A), user),
      ).rejects.toThrow('clave de idempotencia');
    });
  });

  describe('create — descuento', () => {
    const discountDto = (
      lines: { id: string; amount: number }[],
      payments: number[],
      discount: { reason: string; amount: number },
    ): CreateReciboCajaDto =>
      ({
        clientId: CLIENT,
        idempotencyKey: 'key',
        receivables: lines.map((l) => ({
          accountReceivableId: l.id,
          amount: l.amount,
        })),
        payments: payments.map((amount) => ({
          method: 'efectivo_oficina',
          amount,
        })),
        discount,
      }) as CreateReciboCajaDto;

    const expectNothingSaved = () => {
      expect(tx.reciboCaja.create).not.toHaveBeenCalled();
      expect(tx.accountsReceivable.update).not.toHaveBeenCalled();
    };

    it('salda la factura con pagos + descuento y guarda la trazabilidad', async () => {
      mockReceivable(null);
      await service.create(
        discountDto([{ id: 'ar1', amount: 100 }], [90], {
          reason: 'oferta',
          amount: 10,
        }),
        user,
      );
      expect(tx.reciboCaja.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          total: 90,
          discountAmount: 10,
          discountReason: 'oferta',
          debtBeforeReceipt: 100,
        }),
      });
      expect(tx.reciboCajaAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 100, discountAmount: 10 }),
      });
      expect(tx.accountsReceivable.update).toHaveBeenCalledWith({
        where: { id: 'ar1' },
        data: { paidAmount: 100, status: 'paid' },
      });
    });

    it('rechaza descuento con un abono parcial', async () => {
      mockReceivable(null);
      await expect(
        service.create(
          discountDto([{ id: 'ar1', amount: 60 }], [50], {
            reason: 'oferta',
            amount: 10,
          }),
          user,
        ),
      ).rejects.toThrow(
        'El descuento solo aplica si se pagan las facturas completas',
      );
      expectNothingSaved();
    });

    it('rechaza si pagos + descuento no cuadran con los abonos', async () => {
      mockReceivable(null);
      await expect(
        service.create(
          discountDto([{ id: 'ar1', amount: 100 }], [95], {
            reason: 'oferta',
            amount: 10,
          }),
          user,
        ),
      ).rejects.toThrow(
        'El recibo de caja no cuadra: la suma de los abonos debe ser igual a las formas de pago más el descuento',
      );
      expectNothingSaved();
    });

    it('rechaza cubrir el 100% con un motivo distinto a castigo o extravío', async () => {
      mockReceivable(null);
      await expect(
        service.create(
          discountDto([{ id: 'ar1', amount: 100 }], [], {
            reason: 'oferta',
            amount: 100,
          }),
          user,
        ),
      ).rejects.toThrow(
        'Solo Castigo de Cartera o Mercancía Extraviada pueden cubrir el total de la deuda',
      );
      expectNothingSaved();
    });

    it.each(['castigo_cartera', 'mercancia_extraviada'])(
      'acepta cubrir el 100%% sin pagos con %s',
      async (reason) => {
        mockReceivable(null);
        await service.create(
          discountDto([{ id: 'ar1', amount: 100 }], [], {
            reason,
            amount: 100,
          }),
          user,
        );
        expect(tx.reciboCaja.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            total: 0,
            discountAmount: 100,
            discountReason: reason,
          }),
        });
        expect(tx.reciboCajaPayment.createMany).not.toHaveBeenCalled();
        expect(tx.accountsReceivable.update).toHaveBeenCalledWith({
          where: { id: 'ar1' },
          data: { paidAmount: 100, status: 'paid' },
        });
      },
    );

    it('reparte el descuento proporcional al abono de cada factura', async () => {
      tx.accountsReceivable.findMany.mockResolvedValue([
        receivable('ar1', null, 100),
        receivable('ar2', null, 50),
      ]);
      await service.create(
        discountDto(
          [
            { id: 'ar1', amount: 100 },
            { id: 'ar2', amount: 50 },
          ],
          [140],
          { reason: 'promocion', amount: 10 },
        ),
        user,
      );
      expect(tx.reciboCajaAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountReceivableId: 'ar1',
          discountAmount: 6.67,
        }),
      });
      expect(tx.reciboCajaAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountReceivableId: 'ar2',
          discountAmount: 3.33,
        }),
      });
      expect(tx.reciboCaja.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ debtBeforeReceipt: 150 }),
      });
    });

    it('sin descuento: guarda descuento 0 y la deuda antes del recibo', async () => {
      mockReceivable(null);
      await service.create(buildDto('ar1'), user);
      expect(tx.reciboCaja.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          total: 100,
          discountAmount: 0,
          discountReason: null,
          debtBeforeReceipt: 100,
        }),
      });
    });

    it('sin descuento sigue exigiendo que los pagos cuadren con los abonos', async () => {
      mockReceivable(null);
      await expect(
        service.create(
          {
            ...buildDto('ar1'),
            payments: [],
          } as CreateReciboCajaDto,
          user,
        ),
      ).rejects.toThrow('El recibo de caja no cuadra');
      expectNothingSaved();
    });

    it('idempotencia: misma clave con otro descuento es 409', async () => {
      prisma.reciboCaja.findUnique.mockResolvedValue({
        clientId: CLIENT,
        customerBranchId: null,
        total: new Prisma.Decimal(90),
        discountAmount: new Prisma.Decimal(5),
        discountReason: 'oferta',
        allocations: [
          { accountReceivableId: 'ar1', amount: new Prisma.Decimal(100) },
        ],
      });
      await expect(
        service.create(
          discountDto([{ id: 'ar1', amount: 100 }], [90], {
            reason: 'oferta',
            amount: 10,
          }),
          user,
        ),
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
