import { EaiAdjustmentReason, MovementType } from '@/common/enums';
import type { PrismaService } from '@/prisma/prisma.service';
import type { SequenceService } from '@/common/sequence/sequence.service';
import { applyStockChange } from '@/documents/helpers/stock.helpers';
import { EaiEffectStrategy } from './eai-effect.strategy';
import type {
  DocumentToVoid,
  DocumentWithItems,
} from './document-effect.strategy';

jest.mock('@/documents/helpers/stock.helpers', () => ({
  applyStockChange: jest.fn(),
  applyBinStockChange: jest.fn(),
  computeNewAvgCost: jest.fn().mockResolvedValue(12.5),
  calculateAvgCostAfterVoid: jest.fn().mockResolvedValue(10),
  findLastPurchaseCostAfterVoid: jest.fn(),
}));

const applyStockChangeMock = applyStockChange as jest.Mock;

const makeItem = (id: string, productId: string, quantity: number) => ({
  id,
  productId,
  quantity,
  unitCost: 100,
  product: { avgCost: 10 },
});

const makeDocument = (adjustmentReason: EaiAdjustmentReason) =>
  ({
    id: 'doc-1',
    warehouseId: 'w1',
    adjustmentReason,
    adjustmentReasonOther: 'detalle',
    documentItems: [makeItem('i1', 'p1', 3), makeItem('i2', 'p2', 5)],
  }) as unknown as DocumentWithItems;

describe('EaiEffectStrategy', () => {
  const tx = {
    product: { update: jest.fn() },
    inventoryMovement: { create: jest.fn(), findFirst: jest.fn() },
    inventoryCase: { create: jest.fn(), updateMany: jest.fn() },
  };
  const sequence = { next: jest.fn() };
  const strategy = new EaiEffectStrategy(
    {} as PrismaService,
    sequence as unknown as SequenceService,
  );
  const client = tx as never;

  beforeEach(() => {
    jest.clearAllMocks();
    applyStockChangeMock
      .mockResolvedValueOnce({ previousStock: 2, newStock: 5 })
      .mockResolvedValueOnce({ previousStock: 0, newStock: 5 });
    sequence.next
      .mockResolvedValueOnce('000007')
      .mockResolvedValueOnce('000008');
  });

  describe('confirm', () => {
    it('mantiene el comportamiento previo: actualiza el costo promedio y registra el movimiento', async () => {
      await strategy.confirm(
        client,
        makeDocument(EaiAdjustmentReason.inventario_general),
        'u1',
      );

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgCost: 12.5 },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'p1',
          warehouseId: 'w1',
          movementType: MovementType.adjustment,
          quantity: 3,
          previousStock: 2,
          newStock: 5,
          documentId: 'doc-1',
          documentItemId: 'i1',
          userId: 'u1',
        }),
      });
    });

    it('motivo negativo: crea un caso por línea con el stock antes y después del kardex', async () => {
      await strategy.confirm(
        client,
        makeDocument(EaiAdjustmentReason.negativo),
        'u1',
      );

      expect(sequence.next).toHaveBeenCalledWith(tx, 'INVENTORY_CASE');
      expect(tx.inventoryCase.create).toHaveBeenCalledTimes(2);
      expect(tx.inventoryCase.create).toHaveBeenNthCalledWith(1, {
        data: {
          number: '000007',
          documentId: 'doc-1',
          documentItemId: 'i1',
          productId: 'p1',
          warehouseId: 'w1',
          quantity: 3,
          stockBefore: 2,
          stockAfter: 5,
        },
      });
      expect(tx.inventoryCase.create).toHaveBeenNthCalledWith(2, {
        data: {
          number: '000008',
          documentId: 'doc-1',
          documentItemId: 'i2',
          productId: 'p2',
          warehouseId: 'w1',
          quantity: 5,
          stockBefore: 0,
          stockAfter: 5,
        },
      });
    });

    it.each([
      EaiAdjustmentReason.inventario_general,
      EaiAdjustmentReason.traspaso_costo,
      EaiAdjustmentReason.otro,
    ])('motivo %s: no crea casos ni consume consecutivos', async (reason) => {
      await strategy.confirm(client, makeDocument(reason), 'u1');

      expect(tx.inventoryCase.create).not.toHaveBeenCalled();
      expect(sequence.next).not.toHaveBeenCalled();
    });

    it('si el caso no se puede crear, el confirm falla', async () => {
      tx.inventoryCase.create.mockRejectedValueOnce(new Error('boom'));

      await expect(
        strategy.confirm(
          client,
          makeDocument(EaiAdjustmentReason.negativo),
          'u1',
        ),
      ).rejects.toThrow('boom');
    });
  });

  describe('undoEffects', () => {
    const voidedDocument = {
      id: 'doc-1',
      inventoryMovements: [],
    } as unknown as DocumentToVoid;

    it('cierra solo los casos abiertos del documento con causa ajuste_anulado y cierre del sistema', async () => {
      await strategy.undoEffects(client, voidedDocument);

      expect(tx.inventoryCase.updateMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1', status: 'open' },
        data: {
          status: 'closed',
          cause: 'ajuste_anulado',
          closedAt: expect.any(Date),
          closedById: null,
        },
      });
    });
  });
});
