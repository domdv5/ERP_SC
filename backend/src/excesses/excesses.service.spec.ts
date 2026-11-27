import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import type { JwtPayload } from '@/common/types';
import { ExcessesService } from './excesses.service';

const THIRD_PARTY = 'tp1';
const BRANCH = 'b1';
const KEY = '11111111-1111-4111-8111-111111111111';
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
    customerCredit: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      fields: { amount: { ref: 'customerCredit.amount' } },
    },
    supplierCredit: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      fields: { amount: { ref: 'supplierCredit.amount' } },
    },
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
    prisma.customerCredit.findUnique.mockResolvedValue(null);
    prisma.supplierCredit.findUnique.mockResolvedValue(null);
  });

  describe('create', () => {
    it('rechaza un tercero que no es cliente y no crea nada', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue({
        isCustomer: false,
        isSupplier: true,
      });
      const error = await service
        .create(
          {
            partyType: 'customer',
            thirdPartyId: THIRD_PARTY,
            idempotencyKey: KEY,
            amount: 1000,
          },
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
          {
            partyType: 'supplier',
            thirdPartyId: THIRD_PARTY,
            idempotencyKey: KEY,
            amount: 1000,
          },
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
            idempotencyKey: KEY,
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
            idempotencyKey: KEY,
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
            idempotencyKey: KEY,
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
            {
              partyType: 'supplier',
              thirdPartyId: THIRD_PARTY,
              idempotencyKey: KEY,
              amount,
            },
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
          idempotencyKey: KEY,
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
            idempotencyKey: KEY,
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
        {
          partyType: 'customer',
          thirdPartyId: THIRD_PARTY,
          idempotencyKey: KEY,
          amount: 1000,
        },
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
          idempotencyKey: KEY,
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
            idempotencyKey: KEY,
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

  describe('create — idempotencia', () => {
    const body = {
      partyType: 'customer' as const,
      thirdPartyId: THIRD_PARTY,
      customerBranchId: BRANCH,
      amount: 1000,
      date: '2026-11-01',
      idempotencyKey: KEY,
    };
    const conflictMessage =
      'Esta clave de idempotencia ya se usó para un excedente distinto';
    const savedRow = (overrides: Record<string, unknown> = {}) =>
      row({
        customerId: THIRD_PARTY,
        supplierId: THIRD_PARTY,
        customerBranch: { id: BRANCH, name: 'Sede' },
        customerBranchId: BRANCH,
        ...overrides,
      });
    const idempotencyRace = () =>
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['idempotency_key'] },
      });

    it('guarda la clave en el excedente de cliente', async () => {
      await service.create(body, user);
      expect(tx.customerCredit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ idempotencyKey: KEY }),
        }),
      );
    });

    it('guarda la clave en el excedente de proveedor', async () => {
      await service.create(
        { ...body, partyType: 'supplier', customerBranchId: undefined },
        user,
      );
      expect(tx.supplierCredit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ idempotencyKey: KEY }),
        }),
      );
    });

    it('reintento con la misma clave y el mismo body devuelve el excedente ya creado sin consumir número', async () => {
      prisma.customerCredit.findUnique.mockResolvedValue(
        savedRow({ number: '000012' }),
      );
      const result = await service.create(body, user);
      expect(result.number).toBe('000012');
      expect(prisma.customerCredit.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { idempotencyKey: KEY } }),
      );
      expectNothingCreated();
    });

    it('busca la clave también en los excedentes de proveedor', async () => {
      prisma.supplierCredit.findUnique.mockResolvedValue(
        savedRow({ number: '000013' }),
      );
      const result = await service.create(
        { ...body, partyType: 'supplier', customerBranchId: undefined },
        user,
      );
      expect(result.number).toBe('000013');
      expect(result.partyType).toBe('supplier');
      expectNothingCreated();
    });

    it.each([
      ['otro tercero', { thirdPartyId: 'otro' }],
      ['otro valor', { amount: 2000 }],
      ['otra fecha', { date: '2026-11-02' }],
      ['otra sucursal', { customerBranchId: 'otra' }],
      ['sin sucursal', { customerBranchId: undefined }],
      ['otro tipo', { partyType: 'supplier' as const }],
    ])('misma clave con %s → 409 y no crea nada', async (_label, change) => {
      prisma.customerCredit.findUnique.mockResolvedValue(savedRow());
      const error = await service
        .create({ ...body, ...change }, user)
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe(conflictMessage);
      expectNothingCreated();
    });

    it('carrera: si la clave revienta con P2002 devuelve el excedente que ganó', async () => {
      tx.customerCredit.create.mockRejectedValue(idempotencyRace());
      prisma.customerCredit.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedRow({ number: '000012' }));
      const result = await service.create(body, user);
      expect(result.number).toBe('000012');
    });

    it('carrera con un body distinto → 409', async () => {
      tx.customerCredit.create.mockRejectedValue(idempotencyRace());
      prisma.customerCredit.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedRow({ amount: new Prisma.Decimal(5) }));
      const error = await service
        .create(body, user)
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe(conflictMessage);
    });

    it('un P2002 de otra columna no se oculta', async () => {
      const other = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['number'] },
      });
      tx.customerCredit.create.mockRejectedValue(other);
      await expect(service.create(body, user)).rejects.toBe(other);
    });
  });

  describe('findAll — búsqueda por número', () => {
    const numberTermOf = (table: 'customerCredit' | 'supplierCredit') => {
      const call = prisma[table].findMany.mock.calls[0] as [
        { where: { OR: { number?: { contains: string } }[] } },
      ];
      return call[0].where.OR[0];
    };

    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([[], 0]);
    });

    it.each([
      'EXC-000012',
      'EXC 000012',
      'exc000012',
      'Exc - 000012',
      '000012',
    ])('"%s" busca el número 000012', async (search) => {
      await service.findAll({ partyType: 'customer', search });
      expect(numberTermOf('customerCredit')).toEqual({
        number: { contains: '000012' },
      });
    });

    it('proveedor: también quita el prefijo EXC', async () => {
      await service.findAll({ partyType: 'supplier', search: 'EXC-12' });
      expect(numberTermOf('supplierCredit')).toEqual({
        number: { contains: '12' },
      });
    });

    it('un nombre que empieza con "exc" se sigue buscando completo por nombre', async () => {
      await service.findAll({ partyType: 'customer', search: 'Excavaciones' });
      const call = prisma.customerCredit.findMany.mock.calls[0] as [
        { where: { OR: unknown[] } },
      ];
      expect(JSON.stringify(call[0].where.OR)).toContain('"Excavaciones"');
    });

    it('solo "EXC" no filtra por número (evita traer todo por el número)', async () => {
      await service.findAll({ partyType: 'customer', search: 'EXC' });
      const call = prisma.customerCredit.findMany.mock.calls[0] as [
        { where: { OR: { number?: unknown }[] } },
      ];
      expect(call[0].where.OR.some((term) => 'number' in term)).toBe(false);
    });
  });

  describe('findAll — filtro de estado', () => {
    const cases = [
      { table: 'customerCredit', partyType: 'customer' },
      { table: 'supplierCredit', partyType: 'supplier' },
    ] as const;

    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([[], 0]);
    });

    const whereOf = (table: 'customerCredit' | 'supplierCredit') =>
      (
        prisma[table].findMany.mock.calls[0] as [
          { where: Record<string, unknown> },
        ]
      )[0].where;

    it.each(cases)(
      '$partyType available: disponible y nunca usado (balance = amount)',
      async ({ table, partyType }) => {
        await service.findAll({ partyType, status: 'available' });
        const where = whereOf(table);
        expect(where.status).toBe('available');
        expect(where.balance).toEqual({ equals: prisma[table].fields.amount });
      },
    );

    it.each(cases)(
      '$partyType partial: disponible con balance < amount',
      async ({ table, partyType }) => {
        await service.findAll({ partyType, status: 'partial' });
        const where = whereOf(table);
        expect(where.status).toBe('available');
        expect(where.balance).toEqual({ lt: prisma[table].fields.amount });
      },
    );

    it.each(cases)(
      '$partyType used y voided: solo el status, sin filtro de balance',
      async ({ table, partyType }) => {
        await service.findAll({ partyType, status: 'used' });
        await service.findAll({ partyType, status: 'voided' });
        const calls = prisma[table].findMany.mock.calls as [
          { where: Record<string, unknown> },
        ][];
        expect(calls[0][0].where.status).toBe('used');
        expect(calls[1][0].where.status).toBe('voided');
        expect(calls[0][0].where).not.toHaveProperty('balance');
        expect(calls[1][0].where).not.toHaveProperty('balance');
      },
    );

    it.each(cases)(
      '$partyType el count usa el mismo where que las filas',
      async ({ table, partyType }) => {
        await service.findAll({ partyType, status: 'partial' });
        const countCall = prisma[table].count.mock.calls[0] as [
          { where: unknown },
        ];
        expect(countCall[0].where).toBe(whereOf(table));
      },
    );

    it.each(cases)(
      '$partyType sin status: no filtra por estado ni balance',
      async ({ table, partyType }) => {
        await service.findAll({ partyType });
        const where = whereOf(table);
        expect(where).not.toHaveProperty('status');
        expect(where).not.toHaveProperty('balance');
      },
    );
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
        {
          partyType: 'customer',
          thirdPartyId: THIRD_PARTY,
          idempotencyKey: KEY,
          amount: 1000,
        },
        user,
      );
      expect(created.usages).toEqual([{ documentType: 'RC', ...payment }]);
    });
  });
});
