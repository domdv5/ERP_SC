import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import type { JwtPayload } from '@/common/types';
import { ExcessesService } from './excesses.service';

const THIRD_PARTY = 'tp1';
const BRANCH = 'b1';
const user = { sub: 'u1' } as JwtPayload;
const thirdParty = { id: THIRD_PARTY, name: 'Cliente', documentNumber: '900' };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'x1',
  number: '000001',
  date: new Date('2026-11-01'),
  amount: new Prisma.Decimal(1000),
  balance: new Prisma.Decimal(1000),
  status: 'available',
  kind: 'excedente',
  voidedAt: null,
  voidReason: null,
  voidReasonOther: null,
  createdAt: new Date('2026-11-01'),
  customer: { thirdParty },
  supplier: { thirdParty },
  customerBranch: null,
  applications: [],
  ...overrides,
});

describe('ExcessesService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    customerCredit: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    supplierCredit: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    thirdParty: { findUnique: jest.fn() },
    customerBranch: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const sequence = { next: jest.fn() };
  const service = new ExcessesService(
    prisma as unknown as PrismaService,
    sequence as unknown as SequenceService,
  );

  const expectNothingCreated = () => {
    expect(tx.customerCredit.create).not.toHaveBeenCalled();
    expect(tx.supplierCredit.create).not.toHaveBeenCalled();
    expect(sequence.next).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    prisma.thirdParty.findUnique.mockResolvedValue({
      isCustomer: true,
      isSupplier: true,
    });
    prisma.customerBranch.findFirst.mockResolvedValue({ id: BRANCH });
    sequence.next.mockResolvedValue('000007');
    tx.$queryRaw.mockResolvedValue([]);
    tx.customerCredit.create.mockResolvedValue(row());
    tx.supplierCredit.create.mockResolvedValue(row());
  });

  describe('create', () => {
    it('rechaza un tercero que no es cliente y no crea nada', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue({
        isCustomer: false,
        isSupplier: true,
      });
      const error = await service
        .create(
          { partyType: 'customer', thirdPartyId: THIRD_PARTY, amount: 1000 },
          user,
        )
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toBe('Cliente no encontrado');
      expectNothingCreated();
    });

    it('rechaza un tercero que no es proveedor y no crea nada', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue({
        isCustomer: true,
        isSupplier: false,
      });
      const error = await service
        .create(
          { partyType: 'supplier', thirdPartyId: THIRD_PARTY, amount: 1000 },
          user,
        )
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toBe('Proveedor no encontrado');
      expectNothingCreated();
    });

    it('rechaza una sucursal que no es del cliente', async () => {
      prisma.customerBranch.findFirst.mockResolvedValue(null);
      const error = await service
        .create(
          {
            partyType: 'customer',
            thirdPartyId: THIRD_PARTY,
            customerBranchId: 'otra',
            amount: 1000,
          },
          user,
        )
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(
        'La sucursal no pertenece al cliente',
      );
      expect(prisma.customerBranch.findFirst).toHaveBeenCalledWith({
        where: { id: 'otra', customerId: THIRD_PARTY },
        select: { id: true },
      });
      expectNothingCreated();
    });

    it('rechaza una sucursal en un proveedor', async () => {
      const error = await service
        .create(
          {
            partyType: 'supplier',
            thirdPartyId: THIRD_PARTY,
            customerBranchId: BRANCH,
            amount: 1000,
          },
          user,
        )
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(
        'Los proveedores no tienen sucursales',
      );
      expectNothingCreated();
    });

    it('rechaza una fecha futura', async () => {
      const error = await service
        .create(
          {
            partyType: 'customer',
            thirdPartyId: THIRD_PARTY,
            amount: 1000,
            date: '2999-01-01',
          },
          user,
        )
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(
        'La fecha del excedente no puede ser futura',
      );
      expectNothingCreated();
    });

    it.each([0, -5])(
      'rechaza un valor menor o igual a 0 (%p)',
      async (amount) => {
        const error = await service
          .create(
            { partyType: 'supplier', thirdPartyId: THIRD_PARTY, amount },
            user,
          )
          .catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toBe(
          'El valor del excedente debe ser mayor a 0',
        );
        expectNothingCreated();
      },
    );

    it('cliente: consecutivo EXCESS, kind excedente, administración y sucursal', async () => {
      await service.create(
        {
          partyType: 'customer',
          thirdPartyId: THIRD_PARTY,
          customerBranchId: BRANCH,
          amount: 7000000,
          date: '2026-10-29',
        },
        user,
      );
      expect(sequence.next).toHaveBeenCalledWith(tx, 'EXCESS');
      expect(tx.customerCredit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            number: '000007',
            amount: 7000000,
            balance: 7000000,
            status: 'available',
            date: new Date('2026-10-29'),
            userId: 'u1',
            customerId: THIRD_PARTY,
            kind: 'excedente',
            usableIn: 'administracion',
            customerBranchId: BRANCH,
          },
        }),
      );
      expect(tx.supplierCredit.create).not.toHaveBeenCalled();
    });

    it('cliente sin sucursal guarda customerBranchId null', async () => {
      await service.create(
        { partyType: 'customer', thirdPartyId: THIRD_PARTY, amount: 1000 },
        user,
      );
      expect(prisma.customerBranch.findFirst).not.toHaveBeenCalled();
      expect(tx.customerCredit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerBranchId: null }),
        }),
      );
    });

    it('proveedor: consecutivo EXCESS, kind excedente y supplierId', async () => {
      await service.create(
        {
          partyType: 'supplier',
          thirdPartyId: THIRD_PARTY,
          amount: 500,
          date: '2026-10-29',
        },
        user,
      );
      expect(sequence.next).toHaveBeenCalledWith(tx, 'EXCESS');
      expect(tx.supplierCredit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            number: '000007',
            amount: 500,
            balance: 500,
            status: 'available',
            date: new Date('2026-10-29'),
            userId: 'u1',
            supplierId: THIRD_PARTY,
            kind: 'excedente',
          },
        }),
      );
      expect(tx.customerCredit.create).not.toHaveBeenCalled();
    });
  });

  describe('void', () => {
    const usedMessage = 'El excedente ya se usó y no se puede anular';

    it.each([
      ['customer', 'customerCredit'],
      ['supplier', 'supplierCredit'],
    ] as const)(
      '%s: rechaza un excedente con uso vigente y no actualiza',
      async (partyType, table) => {
        tx[table].findUnique.mockResolvedValue(
          row({ applications: [{ id: 'a1' }] }),
        );
        const error = await service
          .void(partyType, 'x1', { reason: 'valor_mal_digitado' }, user)
          .catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toBe(usedMessage);
        expect(tx[table].update).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['customer', 'customerCredit'],
      ['supplier', 'supplierCredit'],
    ] as const)(
      '%s: rechaza un excedente con saldo distinto al valor y no actualiza',
      async (partyType, table) => {
        tx[table].findUnique.mockResolvedValue(
          row({ balance: new Prisma.Decimal(400) }),
        );
        const error = await service
          .void(partyType, 'x1', { reason: 'valor_mal_digitado' }, user)
          .catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toBe(usedMessage);
        expect(tx[table].update).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['customer', 'customerCredit'],
      ['supplier', 'supplierCredit'],
    ] as const)(
      '%s: rechaza un excedente ya anulado y no actualiza',
      async (partyType, table) => {
        tx[table].findUnique.mockResolvedValue(
          row({ status: 'voided', balance: new Prisma.Decimal(0) }),
        );
        const error = await service
          .void(partyType, 'x1', { reason: 'valor_mal_digitado' }, user)
          .catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toBe('El excedente ya está anulado');
        expect(tx[table].update).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['customer', 'customerCredit', null],
      ['customer', 'customerCredit', row({ kind: 'devolucion' })],
      ['supplier', 'supplierCredit', null],
      ['supplier', 'supplierCredit', row({ kind: 'devolucion' })],
    ] as const)(
      '%s: 404 si no existe o no es un excedente',
      async (partyType, table, found) => {
        tx[table].findUnique.mockResolvedValue(found);
        const error = await service
          .void(partyType, 'x1', { reason: 'valor_mal_digitado' }, user)
          .catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as Error).message).toBe('Excedente no encontrado');
        expect(tx[table].update).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['customer', 'customerCredit'],
      ['supplier', 'supplierCredit'],
    ] as const)(
      '%s: guarda el motivo de la lista y reasonOther en null aunque llegue texto',
      async (partyType, table) => {
        tx[table].findUnique.mockResolvedValue(row());
        tx[table].update.mockResolvedValue(row({ status: 'voided' }));
        await service.void(
          partyType,
          'x1',
          { reason: 'tercero_equivocado', reasonOther: 'ignorado' },
          user,
        );
        expect(tx[table].update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'x1' },
            data: expect.objectContaining({
              status: 'voided',
              balance: 0,
              voidedById: 'u1',
              voidReason: 'tercero_equivocado',
              voidReasonOther: null,
            }),
          }),
        );
      },
    );

    it('con motivo otro guarda el texto sin espacios sobrantes', async () => {
      tx.supplierCredit.findUnique.mockResolvedValue(row());
      tx.supplierCredit.update.mockResolvedValue(row({ status: 'voided' }));
      await service.void(
        'supplier',
        'x1',
        { reason: 'otro', reasonOther: '  Se duplicó  ' },
        user,
      );
      expect(tx.supplierCredit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            voidReason: 'otro',
            voidReasonOther: 'Se duplicó',
          }),
        }),
      );
    });
  });

  describe('usages', () => {
    it('muestra una sola vez el recibo que usó el excedente en varias cuentas', async () => {
      const payment = {
        id: 'rc1',
        number: '000017',
        date: new Date('2026-11-17'),
      };
      tx.customerCredit.create.mockResolvedValue(
        row({
          applications: [
            { customerPayment: payment },
            { customerPayment: payment },
          ],
        }),
      );
      const created = await service.create(
        { partyType: 'customer', thirdPartyId: THIRD_PARTY, amount: 1000 },
        user,
      );
      expect(created.usages).toEqual([{ documentType: 'RC', ...payment }]);
    });
  });
});
