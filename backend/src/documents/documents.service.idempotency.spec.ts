import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { DocumentsService } from './documents.service';
import { DocumentEffectsRegistry } from './strategies/document-effects.registry';
import { CreateDocumentDto } from './dto/index';
import { isSameDocumentRequest } from './helpers/idempotency.helpers';

const user = {
  sub: 'u1',
  permissions: ['document.create.POS'],
} as unknown as JwtPayload;

const KEY = '7f3a9c1e-2b4d-4e6f-8a1b-3c5d7e9f0a2b';
const DUPLICATE_MESSAGE =
  'Esta operación ya se registró con datos distintos. Recarga la página y revisa el listado de operaciones.';

const makeDto = (overrides: Partial<CreateDocumentDto> = {}) =>
  ({
    type: DocumentType.POS,
    date: '2026-10-14',
    thirdPartyId: 'c1',
    sellerId: 's1',
    payments: [{ method: 'efectivo', amount: 96800 }],
    items: [
      { productId: 'p1', quantity: 2, unitPrice: 42900 },
      { productId: 'p2', quantity: 1, unitPrice: 10000 },
    ],
    ...overrides,
  }) as CreateDocumentDto;

// Ítems en otro orden que el dto: el orden no cuenta para decidir si es el mismo pedido.
const makeExisting = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  type: DocumentType.POS,
  status: DocumentStatus.draft,
  userId: 'u1',
  thirdPartyId: 'c1',
  sellerId: 's1',
  receiverId: null,
  date: new Date('2026-10-14'),
  payments: [{ method: 'efectivo', amount: new Prisma.Decimal('96800.00') }],
  refundMethod: null,
  notes: null,
  warehouseId: 'store-1',
  destWarehouseId: null,
  destBinId: null,
  sourceBinId: null,
  adjustmentReason: null,
  adjustmentReasonOther: null,
  officialPurchase: false,
  supplierInvoiceNumber: null,
  sourceDocumentId: null,
  idempotencyKey: KEY,
  documentItems: [
    {
      productId: 'p2',
      quantity: 1,
      unitPrice: new Prisma.Decimal('10000.0000'),
      unitCost: new Prisma.Decimal('0'),
      observaciones: null,
    },
    {
      productId: 'p1',
      quantity: 2,
      unitPrice: new Prisma.Decimal('42900.0000'),
      unitCost: new Prisma.Decimal('0'),
      observaciones: null,
    },
  ],
  derivedDocuments: [],
  ...overrides,
});

const SALE_FLAGS = { tracksCustomerBranch: true, usesTodayDate: true };
const OTHER_FLAGS = { tracksCustomerBranch: false, usesTodayDate: false };

const uniqueKeyError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['idempotency_key'] },
  });

describe('DocumentsService.create: clave para no duplicar al reintentar', () => {
  const tx = { document: { create: jest.fn() } };
  const prisma = {
    document: { findUnique: jest.fn() },
    warehouse: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const registry = {
    get: jest.fn((type: DocumentType) => ({
      validateCreate: jest.fn(),
      resolveItemAddedAt: (_requested: string | undefined, now: Date) => now,
      ...(type === DocumentType.CM ? OTHER_FLAGS : SALE_FLAGS),
    })),
  };
  const sequence = { next: jest.fn().mockResolvedValue('000001') };
  const service = new DocumentsService(
    prisma as unknown as PrismaService,
    registry as unknown as DocumentEffectsRegistry,
    sequence as unknown as SequenceService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'store-1' });
    prisma.document.findUnique.mockResolvedValue(null);
    tx.document.create.mockResolvedValue(makeExisting({ id: 'new-doc' }));
  });

  it('sin clave crea el documento como siempre y no busca por clave', async () => {
    const result = await service.create(makeDto(), user);

    expect(result.id).toBe('new-doc');
    expect(tx.document.create).toHaveBeenCalledTimes(1);
    expect(prisma.document.findUnique).not.toHaveBeenCalled();
    expect(tx.document.create.mock.calls[0][0].data.idempotencyKey).toBeNull();
  });

  it('en un tipo distinto de compra no guarda receiverId', async () => {
    await service.create(makeDto({ receiverId: 'r1' }), user);

    expect(tx.document.create.mock.calls[0][0].data.receiverId).toBeUndefined();
  });

  it('con una clave nueva crea el documento y guarda la clave', async () => {
    const result = await service.create(makeDto({ idempotencyKey: KEY }), user);

    expect(result.id).toBe('new-doc');
    expect(tx.document.create).toHaveBeenCalledTimes(1);
    expect(tx.document.create.mock.calls[0][0].data.idempotencyKey).toBe(KEY);
  });

  it('con una clave ya usada y el mismo pedido devuelve el documento existente sin crear otro', async () => {
    prisma.document.findUnique.mockResolvedValue(makeExisting());

    const result = await service.create(makeDto({ idempotencyKey: KEY }), user);

    expect(result.id).toBe('doc-1');
    expect(tx.document.create).not.toHaveBeenCalled();
    expect(sequence.next).not.toHaveBeenCalled();
  });

  it.each([
    [
      'otros ítems',
      {
        documentItems: [
          {
            productId: 'p1',
            quantity: 3,
            unitPrice: new Prisma.Decimal(42900),
            unitCost: new Prisma.Decimal(0),
            observaciones: null,
          },
        ],
      },
    ],
    [
      'otro precio',
      {
        documentItems: [
          {
            productId: 'p1',
            quantity: 2,
            unitPrice: new Prisma.Decimal(42901),
            unitCost: new Prisma.Decimal(0),
            observaciones: null,
          },
          {
            productId: 'p2',
            quantity: 1,
            unitPrice: new Prisma.Decimal(10000),
            unitCost: new Prisma.Decimal(0),
            observaciones: null,
          },
        ],
      },
    ],
    ['otro cliente', { thirdPartyId: 'c2' }],
    ['otro tipo', { type: DocumentType.COT }],
    ['otro usuario', { userId: 'u2' }],
    [
      'otra forma de pago',
      {
        payments: [
          { method: 'transferencia', amount: new Prisma.Decimal(96800) },
        ],
      },
    ],
    [
      'otro monto de pago',
      { payments: [{ method: 'efectivo', amount: new Prisma.Decimal(90000) }] },
    ],
    ['otra vendedora', { sellerId: 's2' }],
    ['otras notas', { notes: 'ajuste' }],
    [
      'otro costo',
      {
        documentItems: [
          {
            productId: 'p1',
            quantity: 2,
            unitPrice: new Prisma.Decimal(42900),
            unitCost: new Prisma.Decimal(5),
            observaciones: null,
          },
          {
            productId: 'p2',
            quantity: 1,
            unitPrice: new Prisma.Decimal(10000),
            unitCost: new Prisma.Decimal(0),
            observaciones: null,
          },
        ],
      },
    ],
  ])(
    'con una clave ya usada pero %s responde 409 y no crea nada',
    async (_case, overrides) => {
      prisma.document.findUnique.mockResolvedValue(makeExisting(overrides));

      await expect(
        service.create(makeDto({ idempotencyKey: KEY }), user),
      ).rejects.toThrow(new ConflictException(DUPLICATE_MESSAGE));
      expect(tx.document.create).not.toHaveBeenCalled();
    },
  );

  it('si dos pedidos con la misma clave chocan al guardar, devuelve el que ganó', async () => {
    prisma.document.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeExisting());
    tx.document.create.mockRejectedValue(uniqueKeyError());

    const result = await service.create(makeDto({ idempotencyKey: KEY }), user);

    expect(result.id).toBe('doc-1');
  });

  it('si chocan al guardar pero el que ganó es otro pedido, responde 409', async () => {
    prisma.document.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeExisting({ thirdPartyId: 'c2' }));
    tx.document.create.mockRejectedValue(uniqueKeyError());

    await expect(
      service.create(makeDto({ idempotencyKey: KEY }), user),
    ).rejects.toThrow(new ConflictException(DUPLICATE_MESSAGE));
  });
});

describe('isSameDocumentRequest: receiverId en la compra', () => {
  const cmDto = (receiverId: string) =>
    makeDto({ type: DocumentType.CM, receiverId });
  const cmExisting = (receiverId: string | null) =>
    makeExisting({ type: DocumentType.CM, receiverId });

  it('es el mismo pedido si receiverId coincide', () => {
    expect(
      isSameDocumentRequest(
        cmDto('r1'),
        cmExisting('r1') as never,
        'u1',
        OTHER_FLAGS,
      ),
    ).toBe(true);
  });

  it('es otro pedido si receiverId cambia', () => {
    expect(
      isSameDocumentRequest(
        cmDto('r2'),
        cmExisting('r1') as never,
        'u1',
        OTHER_FLAGS,
      ),
    ).toBe(false);
  });
});

describe('isSameDocumentRequest: customerBranchId en las ventas', () => {
  const saleDto = (customerBranchId?: string) =>
    makeDto({ type: DocumentType.COT, customerBranchId });
  const saleExisting = (customerBranchId: string | null) =>
    makeExisting({ type: DocumentType.COT, customerBranchId });

  it('es el mismo pedido si la sucursal coincide', () => {
    expect(
      isSameDocumentRequest(
        saleDto('b1'),
        saleExisting('b1') as never,
        'u1',
        SALE_FLAGS,
      ),
    ).toBe(true);
  });

  it('es otro pedido si la sucursal cambia', () => {
    expect(
      isSameDocumentRequest(
        saleDto('b2'),
        saleExisting('b1') as never,
        'u1',
        SALE_FLAGS,
      ),
    ).toBe(false);
  });

  it('en un tipo que no es venta ignora la sucursal del pedido', () => {
    expect(
      isSameDocumentRequest(
        makeDto({ type: DocumentType.CM, customerBranchId: 'b1' }),
        makeExisting({
          type: DocumentType.CM,
          customerBranchId: null,
        }) as never,
        'u1',
        OTHER_FLAGS,
      ),
    ).toBe(true);
  });
});

describe('isSameDocumentRequest: fecha fijada por el servidor', () => {
  it('en REM/POS/COT la fecha del pedido no cuenta', () => {
    expect(
      isSameDocumentRequest(
        makeDto({ date: '2026-01-05' }),
        makeExisting() as never,
        'u1',
        SALE_FLAGS,
      ),
    ).toBe(true);
  });

  it('en los demás tipos una fecha distinta es otro pedido', () => {
    expect(
      isSameDocumentRequest(
        makeDto({ type: DocumentType.CM, date: '2026-01-05' }),
        makeExisting({ type: DocumentType.CM }) as never,
        'u1',
        OTHER_FLAGS,
      ),
    ).toBe(false);
  });
});

describe('DocumentsService.create: customerBranchId solo en ventas', () => {
  const tx = { document: { create: jest.fn() } };
  const prisma = {
    document: { findUnique: jest.fn() },
    warehouse: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const registry = {
    get: jest.fn((type: DocumentType) => ({
      validateCreate: jest.fn(),
      resolveItemAddedAt: (_requested: string | undefined, now: Date) => now,
      ...(type === DocumentType.CM ? OTHER_FLAGS : SALE_FLAGS),
    })),
  };
  const sequence = { next: jest.fn().mockResolvedValue('000001') };
  const service = new DocumentsService(
    prisma as unknown as PrismaService,
    registry as unknown as DocumentEffectsRegistry,
    sequence as unknown as SequenceService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'store-1' });
    tx.document.create.mockResolvedValue(makeExisting({ id: 'new-doc' }));
  });

  it('guarda la sucursal en una venta', async () => {
    await service.create(makeDto({ customerBranchId: 'b1' }), user);

    expect(tx.document.create.mock.calls[0][0].data.customerBranchId).toBe(
      'b1',
    );
  });

  it('descarta la sucursal en un tipo que no es venta', async () => {
    const cmUser = {
      sub: 'u1',
      permissions: ['document.create.CM'],
    } as unknown as JwtPayload;

    await service.create(
      makeDto({ type: DocumentType.CM, customerBranchId: 'b1' }),
      cmUser,
    );

    expect(
      tx.document.create.mock.calls[0][0].data.customerBranchId,
    ).toBeNull();
  });
});
