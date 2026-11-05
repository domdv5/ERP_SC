import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryCaseCause, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { InventoryCasesService } from './inventory-cases.service';

const NOW = new Date('2026-11-15T15:00:00.000Z');
const at = (value: string) => new Date(value);

type Movement = {
  id: string;
  createdAt: Date;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  productId: string;
  warehouseId: string;
  documentItemId: string | null;
  documentId: string | null;
  document: { id: string; type: string; number: string } | null;
  user: { id: string; name: string } | null;
};

const makeMovement = (overrides: Partial<Movement>): Movement => ({
  id: 'm',
  createdAt: at('2026-11-01T10:00:00.000Z'),
  movementType: 'sale',
  quantity: -1,
  previousStock: 10,
  newStock: 9,
  productId: 'p1',
  warehouseId: 'w1',
  documentItemId: null,
  documentId: null,
  document: null,
  user: { id: 'u2', name: 'Bea' },
  ...overrides,
});

const docRef = (id: string) => ({ id, type: 'POS', number: `N-${id}` });

// Kardex en memoria: aplica solo los filtros que usa el service, para probar qué movimientos entran y cuáles no.
function matchesWhere(movement: Movement, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = movement[key as keyof Movement];
    if (expected instanceof Object && !(expected instanceof Date)) {
      const filter = expected as Record<string, Date | null>;
      if ('not' in filter) return actual !== filter.not;
      if ('lt' in filter) return (actual as Date) < filter.lt!;
      if ('lte' in filter) return (actual as Date) <= filter.lte!;
    }
    return actual === expected;
  });
}

const EAI_MOVEMENT = makeMovement({
  id: 'm-eai',
  createdAt: at('2026-11-05T10:00:00.000Z'),
  movementType: 'adjustment',
  quantity: 3,
  previousStock: 0,
  newStock: 3,
  documentItemId: 'item-1',
  documentId: 'eai-1',
  document: { id: 'eai-1', type: 'EAI', number: '000001' },
});

describe('InventoryCasesService', () => {
  const prisma = {
    $transaction: jest.fn(),
    inventoryCase: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    inventoryMovement: { findFirst: jest.fn(), findMany: jest.fn() },
    warehouse: { findMany: jest.fn() },
  };
  const service = new InventoryCasesService(prisma as unknown as PrismaService);

  let kardex: Movement[];

  const sortNewestFirst = (rows: Movement[]) =>
    [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const baseCase = {
    id: 'case-1',
    number: '000001',
    createdAt: at('2026-11-05T10:00:00.000Z'),
    status: 'open',
    closedAt: null,
    cause: null,
    justification: null,
    quantity: 3,
    stockBefore: 0,
    stockAfter: 3,
    productId: 'p1',
    warehouseId: 'w1',
    documentItemId: 'item-1',
    product: {
      id: 'p1',
      code: 'A-1',
      description: 'Camisa',
      brand: { name: 'Marca' },
    },
    warehouse: { id: 'w1', name: 'Almacén' },
    document: {
      id: 'eai-1',
      type: 'EAI',
      number: '000001',
      notes: null,
      user: { id: 'u1', name: 'Ana' },
    },
    originDocument: null,
    closedBy: null,
    reopenedBy: null,
    reopenedAt: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ now: NOW });
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    kardex = [EAI_MOVEMENT];
    prisma.inventoryMovement.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          sortNewestFirst(kardex.filter((m) => matchesWhere(m, where)))[0] ??
            null,
        ),
    );
    prisma.inventoryMovement.findMany.mockImplementation(
      ({ where, take }: { where: Record<string, unknown>; take: number }) =>
        Promise.resolve(
          sortNewestFirst(kardex.filter((m) => matchesWhere(m, where))).slice(
            0,
            take,
          ),
        ),
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('findAll', () => {
    const mockList = (
      items: unknown[] = [],
      closedThisMonth: unknown[] = [],
      openCount = 0,
    ) => {
      prisma.inventoryCase.findMany
        .mockResolvedValueOnce(items)
        .mockResolvedValueOnce(closedThisMonth);
      prisma.inventoryCase.count
        .mockResolvedValueOnce(items.length)
        .mockResolvedValueOnce(openCount);
    };

    it('aplica los filtros, pagina y ordena del más nuevo al más viejo', async () => {
      mockList();

      await service.findAll({
        status: 'open',
        warehouseId: 'w1',
        from: '2026-11-01',
        to: '2026-11-10',
        search: ' camisa ',
        page: 2,
        limit: 5,
      });

      const args = prisma.inventoryCase.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        status: 'open',
        warehouseId: 'w1',
        createdAt: {
          gte: at('2026-11-01T05:00:00.000Z'),
          lte: at('2026-11-11T04:59:59.999Z'),
        },
        product: {
          OR: [
            { code: { contains: 'camisa', mode: 'insensitive' } },
            { description: { contains: 'camisa', mode: 'insensitive' } },
          ],
        },
      });
      expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
      expect([args.skip, args.take]).toEqual([5, 5]);
    });

    it('sin filtros no restringe nada', async () => {
      mockList();

      await service.findAll({});

      expect(prisma.inventoryCase.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('rechaza un rango con from posterior a to', async () => {
      await expect(
        service.findAll({ from: '2026-11-10', to: '2026-11-01' }),
      ).rejects.toThrow(
        new BadRequestException('from no puede ser posterior a to'),
      );
      expect(prisma.inventoryCase.findMany).not.toHaveBeenCalled();
    });

    it('arma cada fila con marca, ajuste, quién ajustó y días abierto', async () => {
      const closed = {
        ...baseCase,
        id: 'case-2',
        status: 'closed',
        createdAt: at('2026-11-01T10:00:00.000Z'),
        closedAt: at('2026-11-04T10:30:00.000Z'),
      };
      mockList([baseCase, closed], [], 1);

      const { items, meta } = await service.findAll({});

      expect(items[0]).toMatchObject({
        id: 'case-1',
        number: '000001',
        product: {
          id: 'p1',
          code: 'A-1',
          description: 'Camisa',
          brandName: 'Marca',
        },
        warehouse: { id: 'w1', name: 'Almacén' },
        quantity: 3,
        stockBefore: 0,
        stockAfter: 3,
        adjustmentDocument: { id: 'eai-1', type: 'EAI', number: '000001' },
        adjustedBy: { id: 'u1', name: 'Ana' },
        status: 'open',
        closedAt: null,
        daysOpen: 10,
      });
      // Cerrado: cuenta hasta la fecha de cierre, no hasta hoy.
      expect(items[1]).toMatchObject({ daysOpen: 3 });
      expect(meta).toMatchObject({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('devuelve los contadores: abiertos, cerrados este mes y promedio de días', async () => {
      mockList(
        [],
        [
          {
            createdAt: at('2026-11-01T00:00:00.000Z'),
            closedAt: at('2026-11-03T00:00:00.000Z'),
          },
          {
            createdAt: at('2026-11-02T00:00:00.000Z'),
            closedAt: at('2026-11-07T00:00:00.000Z'),
          },
          {
            createdAt: at('2026-11-10T00:00:00.000Z'),
            closedAt: at('2026-11-10T08:00:00.000Z'),
          },
        ],
        7,
      );

      const { meta } = await service.findAll({ status: 'closed' });

      expect(meta.openCount).toBe(7);
      expect(meta.closedThisMonth).toBe(3);
      // (2 + 5 + 0.33) / 3 = 2.44 → 2.4
      expect(meta.avgDaysToClose).toBe(2.4);
      // Los contadores no se recortan por los filtros de la bandeja.
      expect(prisma.inventoryCase.count.mock.calls[1][0]).toEqual({
        where: { status: 'open' },
      });
      expect(
        prisma.inventoryCase.findMany.mock.calls[1][0].where.closedAt,
      ).toEqual({ gte: at('2026-11-01T05:00:00.000Z') });
    });

    it('los casos cerrados por ajuste_anulado no cuentan en cerrados del mes ni en el promedio', async () => {
      mockList(
        [],
        [
          {
            cause: 'error_conteo',
            createdAt: at('2026-11-01T00:00:00.000Z'),
            closedAt: at('2026-11-03T00:00:00.000Z'),
          },
          {
            cause: 'ajuste_anulado',
            createdAt: at('2026-11-02T00:00:00.000Z'),
            closedAt: at('2026-11-12T00:00:00.000Z'),
          },
        ],
        2,
      );

      const { meta } = await service.findAll({});

      expect(meta.closedThisMonth).toBe(1);
      expect(meta.avgDaysToClose).toBe(2);
      expect(meta.openCount).toBe(2);
    });

    it('si el único cerrado del mes es ajuste_anulado, el promedio es null', async () => {
      mockList(
        [],
        [
          {
            cause: 'ajuste_anulado',
            createdAt: at('2026-11-02T00:00:00.000Z'),
            closedAt: at('2026-11-02T01:00:00.000Z'),
          },
        ],
      );

      const { meta } = await service.findAll({});

      expect(meta.closedThisMonth).toBe(0);
      expect(meta.avgDaysToClose).toBeNull();
    });

    it('la bandeja sigue listando los casos ajuste_anulado', async () => {
      mockList([
        {
          ...baseCase,
          status: 'closed',
          cause: 'ajuste_anulado',
          closedAt: at('2026-11-06T10:00:00.000Z'),
        },
      ]);

      const { items } = await service.findAll({ status: 'closed' });

      expect(items.map((item) => item.id)).toEqual(['case-1']);
    });

    it('sin casos cerrados este mes el promedio es null', async () => {
      mockList();

      const { meta } = await service.findAll({});

      expect(meta.closedThisMonth).toBe(0);
      expect(meta.avgDaysToClose).toBeNull();
    });
  });

  describe('findWarehouses', () => {
    it('devuelve las bodegas activas con id y nombre, ordenadas por nombre', async () => {
      prisma.warehouse.findMany.mockResolvedValue([
        { id: 'w1', name: 'Almacén' },
        { id: 'w2', name: 'Bodega' },
      ]);

      await expect(service.findWarehouses()).resolves.toEqual([
        { id: 'w1', name: 'Almacén' },
        { id: 'w2', name: 'Bodega' },
      ]);
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getOpenCount', () => {
    it('cuenta solo los casos abiertos', async () => {
      prisma.inventoryCase.count.mockResolvedValue(4);

      await expect(service.getOpenCount()).resolves.toEqual({ count: 4 });
      expect(prisma.inventoryCase.count).toHaveBeenCalledWith({
        where: { status: 'open' },
      });
    });
  });

  describe('findOne', () => {
    beforeEach(() => {
      prisma.inventoryCase.findUnique.mockResolvedValue({
        ...baseCase,
        document: { ...baseCase.document, notes: 'Conteo del jueves' },
      });
    });

    it('lanza 404 si el caso no existe', async () => {
      prisma.inventoryCase.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(
        new NotFoundException('Caso no encontrado'),
      );
    });

    it('trae las notas de la EAI y los movimientos del más viejo al más nuevo, con el ajuste incluido', async () => {
      kardex = [
        makeMovement({
          id: 'm-old',
          createdAt: at('2026-11-01T10:00:00.000Z'),
        }),
        makeMovement({
          id: 'm-mid',
          createdAt: at('2026-11-03T10:00:00.000Z'),
        }),
        EAI_MOVEMENT,
      ];

      const detail = await service.findOne('case-1');

      expect(detail.notes).toBe('Conteo del jueves');
      expect(detail.movements.map((m) => m.id)).toEqual([
        'm-old',
        'm-mid',
        'm-eai',
      ]);
    });

    it('trae máximo 10 movimientos: los más recientes hasta el ajuste', async () => {
      kardex = [
        ...Array.from({ length: 12 }, (_, index) =>
          makeMovement({
            id: `m-${index}`,
            createdAt: at(
              `2026-11-0${index < 4 ? 1 : 2}T${10 + index}:00:00.000Z`,
            ),
          }),
        ),
        EAI_MOVEMENT,
      ];

      const detail = await service.findOne('case-1');

      expect(detail.movements).toHaveLength(10);
      expect(detail.movements.at(-1)?.id).toBe('m-eai');
      expect(detail.movements[0].id).toBe('m-3');
    });

    it('no incluye movimientos posteriores al ajuste', async () => {
      kardex = [
        EAI_MOVEMENT,
        makeMovement({
          id: 'm-after',
          createdAt: at('2026-11-06T10:00:00.000Z'),
        }),
      ];

      const detail = await service.findOne('case-1');

      expect(detail.movements.map((m) => m.id)).toEqual(['m-eai']);
    });

    it('sugiere como origen la salida más reciente antes del ajuste que sacó exactamente las unidades ajustadas', async () => {
      kardex = [
        makeMovement({
          id: 'm-older',
          createdAt: at('2026-11-01T10:00:00.000Z'),
          quantity: -3,
          documentId: 'd-older',
          document: docRef('d-older'),
        }),
        makeMovement({
          id: 'm-other-qty',
          createdAt: at('2026-11-04T10:00:00.000Z'),
          quantity: -2,
          documentId: 'd-other-qty',
          document: docRef('d-other-qty'),
        }),
        makeMovement({
          id: 'm-match',
          createdAt: at('2026-11-03T10:00:00.000Z'),
          quantity: -3,
          documentId: 'd-match',
          document: docRef('d-match'),
        }),
        EAI_MOVEMENT,
      ];

      const detail = await service.findOne('case-1');

      expect(detail.suggestedOriginDocumentId).toBe('d-match');
    });

    it('no sugiere una salida que quedó fuera de los 10 movimientos mostrados', async () => {
      kardex = [
        makeMovement({
          id: 'm-far',
          createdAt: at('2026-10-01T10:00:00.000Z'),
          quantity: -3,
          documentId: 'd-far',
          document: docRef('d-far'),
        }),
        ...Array.from({ length: 10 }, (_, index) =>
          makeMovement({
            id: `m-near-${index}`,
            createdAt: at(
              `2026-11-0${index < 4 ? 1 : 2}T${10 + index}:00:00.000Z`,
            ),
            quantity: 1,
          }),
        ),
        EAI_MOVEMENT,
      ];

      const detail = await service.findOne('case-1');

      expect(detail.movements.map((m) => m.id)).not.toContain('m-far');
      expect(detail.suggestedOriginDocumentId).toBeNull();
    });

    it('la sugerencia siempre es un documento de los movimientos mostrados', async () => {
      kardex = [
        makeMovement({
          id: 'm-match',
          createdAt: at('2026-11-03T10:00:00.000Z'),
          quantity: -3,
          documentId: 'd-match',
          document: docRef('d-match'),
        }),
        EAI_MOVEMENT,
      ];

      const detail = await service.findOne('case-1');

      expect(detail.movements.map((m) => m.document?.id)).toContain(
        detail.suggestedOriginDocumentId,
      );
    });

    it('no sugiere nada si ninguna salida coincide con la cantidad', async () => {
      kardex = [
        makeMovement({
          id: 'm-other',
          createdAt: at('2026-11-03T10:00:00.000Z'),
          quantity: -2,
          documentId: 'd-other',
          document: docRef('d-other'),
        }),
        EAI_MOVEMENT,
      ];

      const detail = await service.findOne('case-1');

      expect(detail.suggestedOriginDocumentId).toBeNull();
    });

    it('ignora una salida posterior al ajuste aunque coincida con la cantidad', async () => {
      kardex = [
        EAI_MOVEMENT,
        makeMovement({
          id: 'm-after',
          createdAt: at('2026-11-06T10:00:00.000Z'),
          quantity: -3,
          documentId: 'd-after',
          document: docRef('d-after'),
        }),
      ];

      const detail = await service.findOne('case-1');

      expect(detail.suggestedOriginDocumentId).toBeNull();
    });

    it('ignora los movimientos de otra bodega o de otro producto', async () => {
      kardex = [
        makeMovement({
          id: 'm-other-warehouse',
          createdAt: at('2026-11-03T10:00:00.000Z'),
          quantity: -3,
          warehouseId: 'w2',
          documentId: 'd-w2',
          document: docRef('d-w2'),
        }),
        makeMovement({
          id: 'm-other-product',
          createdAt: at('2026-11-03T11:00:00.000Z'),
          quantity: -3,
          productId: 'p2',
          documentId: 'd-p2',
          document: docRef('d-p2'),
        }),
        EAI_MOVEMENT,
      ];

      const detail = await service.findOne('case-1');

      expect(detail.suggestedOriginDocumentId).toBeNull();
      expect(detail.movements.map((m) => m.id)).toEqual(['m-eai']);
    });
  });

  describe('close', () => {
    const closeDto = {
      cause: InventoryCaseCause.error_conteo,
      justification: '  Se contó mal el estante  ',
    };

    beforeEach(() => {
      prisma.inventoryCase.findUnique.mockResolvedValue(baseCase);
      prisma.inventoryCase.updateMany.mockResolvedValue({ count: 1 });
    });

    it('cierra el caso con causa, justificación recortada, quién y cuándo', async () => {
      await service.close('case-1', closeDto, 'u9');

      expect(prisma.inventoryCase.updateMany).toHaveBeenCalledWith({
        where: { id: 'case-1', status: 'open' },
        data: {
          status: 'closed',
          cause: 'error_conteo',
          justification: 'Se contó mal el estante',
          originDocumentId: null,
          closedById: 'u9',
          closedAt: NOW,
        },
      });
    });

    it('acepta como origen un documento de los movimientos del caso', async () => {
      kardex = [
        makeMovement({
          id: 'm-sale',
          createdAt: at('2026-11-03T10:00:00.000Z'),
          documentId: 'd-sale',
          document: docRef('d-sale'),
        }),
        EAI_MOVEMENT,
      ];

      await service.close(
        'case-1',
        { ...closeDto, originDocumentId: 'd-sale' },
        'u9',
      );

      expect(
        prisma.inventoryCase.updateMany.mock.calls[0][0].data.originDocumentId,
      ).toBe('d-sale');
    });

    it('rechaza el origen que no es uno de los movimientos del caso', async () => {
      await expect(
        service.close(
          'case-1',
          { ...closeDto, originDocumentId: 'ajeno' },
          'u9',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'El documento de origen debe ser uno de los movimientos del caso',
        ),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza la causa ajuste_anulado, que solo la pone el sistema', async () => {
      await expect(
        service.close(
          'case-1',
          { ...closeDto, cause: InventoryCaseCause.ajuste_anulado },
          'u9',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'La causa "Ajuste anulado" solo la asigna el sistema al anular el ajuste',
        ),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });

    it.each(['', '   '])(
      'rechaza la justificación vacía (%j)',
      async (justification) => {
        await expect(
          service.close('case-1', { ...closeDto, justification }, 'u9'),
        ).rejects.toThrow(
          new BadRequestException('La justificación es obligatoria'),
        );
        expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
      },
    );

    it('rechaza una justificación de más de 1000 caracteres', async () => {
      await expect(
        service.close(
          'case-1',
          { ...closeDto, justification: 'x'.repeat(1001) },
          'u9',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'La justificación no puede superar los 1000 caracteres',
        ),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza un caso que ya está cerrado', async () => {
      prisma.inventoryCase.findUnique.mockResolvedValue({
        ...baseCase,
        status: 'closed',
      });

      await expect(service.close('case-1', closeDto, 'u9')).rejects.toThrow(
        new ConflictException('El caso ya está cerrado'),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });

    it('si otra persona lo cerró primero (la actualización no cambia nada) lanza conflicto', async () => {
      prisma.inventoryCase.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.close('case-1', closeDto, 'u9')).rejects.toThrow(
        new ConflictException('El caso ya fue cerrado por otra persona'),
      );
    });

    it('lanza 404 si el caso no existe', async () => {
      prisma.inventoryCase.findUnique.mockResolvedValue(null);

      await expect(service.close('nope', closeDto, 'u9')).rejects.toThrow(
        new NotFoundException('Caso no encontrado'),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('reopen', () => {
    beforeEach(() => {
      prisma.inventoryCase.findUnique.mockResolvedValue({
        ...baseCase,
        status: 'closed',
      });
      prisma.inventoryCase.updateMany.mockResolvedValue({ count: 1 });
    });

    it('reabre el caso, borra el cierre y registra quién y cuándo lo reabrió', async () => {
      await service.reopen('case-1', 'admin-1');

      expect(prisma.inventoryCase.updateMany).toHaveBeenCalledWith({
        where: { id: 'case-1', status: 'closed' },
        data: {
          status: 'open',
          cause: null,
          justification: null,
          originDocumentId: null,
          closedById: null,
          closedAt: null,
          reopenedById: 'admin-1',
          reopenedAt: NOW,
        },
      });
    });

    it('rechaza reabrir un caso cerrado por anulación del ajuste', async () => {
      prisma.inventoryCase.findUnique.mockResolvedValue({
        ...baseCase,
        status: 'closed',
        cause: 'ajuste_anulado',
      });

      await expect(service.reopen('case-1', 'admin-1')).rejects.toThrow(
        new BadRequestException(
          'No se puede reabrir un caso cerrado por anulación del ajuste',
        ),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });

    it.each(['error_conteo', 'otro'])(
      'rechaza reabrir un caso (causa %s) cuyo ajuste fue anulado después',
      async (cause) => {
        prisma.inventoryCase.findUnique.mockResolvedValue({
          ...baseCase,
          status: 'closed',
          cause,
          document: { ...baseCase.document, status: 'voided' },
        });

        await expect(service.reopen('case-1', 'admin-1')).rejects.toThrow(
          new BadRequestException(
            'No se puede reabrir: el ajuste de este caso fue anulado',
          ),
        );
        expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
      },
    );

    it('rechaza reabrir un caso que está abierto', async () => {
      prisma.inventoryCase.findUnique.mockResolvedValue(baseCase);

      await expect(service.reopen('case-1', 'admin-1')).rejects.toThrow(
        new ConflictException('Solo se pueden reabrir casos cerrados'),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });

    it('lanza 404 si el caso no existe', async () => {
      prisma.inventoryCase.findUnique.mockResolvedValue(null);

      await expect(service.reopen('nope', 'admin-1')).rejects.toThrow(
        new NotFoundException('Caso no encontrado'),
      );
      expect(prisma.inventoryCase.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getReport', () => {
    const range = {
      from: at('2026-11-01T00:00:00.000Z'),
      to: at('2026-11-10T00:00:00.000Z'),
    };
    const reportCase = (overrides: Record<string, unknown>) => ({
      status: 'closed',
      cause: 'venta_otro_producto',
      quantity: 1,
      productId: 'p1',
      warehouseId: 'w1',
      product: { code: 'A-1', description: 'Camisa' },
      warehouse: { name: 'Almacén' },
      documentItem: { unitCost: new Prisma.Decimal('10.5') },
      ...overrides,
    });

    it('filtra por el rango (día de Bogotá) y por bodega', async () => {
      prisma.inventoryCase.findMany.mockResolvedValue([]);

      await service.getReport(range, 'w1');

      expect(prisma.inventoryCase.findMany.mock.calls[0][0].where).toEqual({
        createdAt: {
          gte: at('2026-11-01T05:00:00.000Z'),
          lte: at('2026-11-11T04:59:59.999Z'),
        },
        warehouseId: 'w1',
      });
    });

    it('el informe excluye por completo los casos ajuste_anulado', async () => {
      prisma.inventoryCase.findMany.mockResolvedValue([
        reportCase({ quantity: 2 }),
        reportCase({
          cause: 'ajuste_anulado',
          quantity: 50,
          productId: 'p9',
          warehouseId: 'w9',
          product: { code: 'Z-9', description: 'Anulado' },
          warehouse: { name: 'Otra' },
        }),
      ]);

      const report = await service.getReport(range, null);

      expect(report.totals).toEqual({
        cases: 1,
        closed: 1,
        open: 0,
        units: 2,
        approxCost: 21,
      });
      expect(report.byCause).toEqual([
        { cause: 'venta_otro_producto', count: 1 },
      ]);
      expect(report.byWarehouse.map((row) => row.warehouseId)).toEqual(['w1']);
      expect(report.topProducts.map((row) => row.productId)).toEqual(['p1']);
    });

    it('sin casos devuelve todo en cero', async () => {
      prisma.inventoryCase.findMany.mockResolvedValue([]);

      await expect(service.getReport(range, null)).resolves.toEqual({
        totals: { cases: 0, closed: 0, open: 0, units: 0, approxCost: 0 },
        byCause: [],
        byWarehouse: [],
        topProducts: [],
      });
    });

    it('agrega totales, causas, bodegas y productos', async () => {
      prisma.inventoryCase.findMany.mockResolvedValue([
        reportCase({ quantity: 3 }),
        reportCase({ quantity: 2 }),
        reportCase({
          quantity: 1,
          cause: 'error_conteo',
          productId: 'p2',
          warehouseId: 'w2',
          product: { code: 'B-2', description: 'Pantalón' },
          warehouse: { name: 'Bodega' },
          documentItem: { unitCost: new Prisma.Decimal('100') },
        }),
        reportCase({
          status: 'open',
          cause: null,
          quantity: 4,
          productId: 'p3',
          warehouseId: 'w2',
          product: { code: 'C-3', description: 'Gorra' },
          warehouse: { name: 'Bodega' },
          documentItem: { unitCost: new Prisma.Decimal('1.25') },
        }),
      ]);

      const report = await service.getReport(range, null);

      expect(report.totals).toEqual({
        cases: 4,
        closed: 3,
        open: 1,
        units: 10,
        // 3×10.5 + 2×10.5 + 1×100 + 4×1.25
        approxCost: 157.5,
      });
      // Solo cuentan los casos cerrados, de mayor a menor.
      expect(report.byCause).toEqual([
        { cause: 'venta_otro_producto', count: 2 },
        { cause: 'error_conteo', count: 1 },
      ]);
      expect(report.byWarehouse).toEqual([
        { warehouseId: 'w1', name: 'Almacén', count: 2, approxCost: 52.5 },
        { warehouseId: 'w2', name: 'Bodega', count: 2, approxCost: 105 },
      ]);
      // Empate en casos: más unidades primero.
      expect(report.topProducts).toEqual([
        {
          productId: 'p1',
          code: 'A-1',
          description: 'Camisa',
          count: 2,
          units: 5,
          approxCost: 52.5,
          mostCommonCause: 'venta_otro_producto',
        },
        {
          productId: 'p3',
          code: 'C-3',
          description: 'Gorra',
          count: 1,
          units: 4,
          approxCost: 5,
          mostCommonCause: null,
        },
        {
          productId: 'p2',
          code: 'B-2',
          description: 'Pantalón',
          count: 1,
          units: 1,
          approxCost: 100,
          mostCommonCause: 'error_conteo',
        },
      ]);
    });

    it('la causa más común del producto es la más repetida entre sus casos cerrados', async () => {
      prisma.inventoryCase.findMany.mockResolvedValue([
        reportCase({ cause: 'error_conteo' }),
        reportCase({ cause: 'perdida_faltante' }),
        reportCase({ cause: 'perdida_faltante' }),
      ]);

      const report = await service.getReport(range, null);

      expect(report.topProducts[0].mostCommonCause).toBe('perdida_faltante');
    });

    it('los productos más ajustados se limitan a 10', async () => {
      prisma.inventoryCase.findMany.mockResolvedValue(
        Array.from({ length: 12 }, (_, index) =>
          reportCase({
            productId: `p${index}`,
            product: { code: `C-${index}`, description: 'x' },
          }),
        ),
      );

      const report = await service.getReport(range, null);

      expect(report.topProducts).toHaveLength(10);
      expect(report.totals.cases).toBe(12);
    });
  });
});
