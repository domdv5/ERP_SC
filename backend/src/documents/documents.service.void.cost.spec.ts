import { ConflictException } from '@nestjs/common';
import { DocumentType, MovementType } from '@/common/enums';
import { undoCustomerCreditApplications } from './helpers/customer-credit.helpers';
import { assertAvailableForReservation } from './helpers/reservation.helpers';
import {
  applyBinStockChange,
  applyStockChange,
  calculateAvgCostAfterVoid,
  findLastPurchaseCostAfterVoid,
} from './helpers/stock.helpers';
import {
  createVoidHarness,
  fullUser,
  makeMovement,
  resetVoidHarness,
} from './documents.service.void.fixtures';

jest.mock('./helpers/stock.helpers', () => ({
  applyStockChange: jest.fn(),
  applyBinStockChange: jest.fn(),
  calculateAvgCostAfterVoid: jest.fn(),
  findLastPurchaseCostAfterVoid: jest.fn(),
}));
jest.mock('./helpers/customer-credit.helpers', () => ({
  undoCustomerCreditApplications: jest.fn(),
}));
jest.mock('./helpers/reservation.helpers', () => ({
  ...jest.requireActual('./helpers/reservation.helpers'),
  assertAvailableForReservation: jest.fn(),
}));

describe('DocumentsService.void: compra y costos', () => {
  const harness = createVoidHarness();
  const { tx, service, found, loadDocument } = harness;

  beforeEach(() => {
    resetVoidHarness(harness);
  });

  describe('CM (compra): stock, costo promedio, último costo y CxP', () => {
    const movement = makeMovement();

    beforeEach(() => {
      loadDocument(DocumentType.CM, {
        inventoryMovements: [movement],
        accountsPayable: [
          {
            payablePayments: [],
            creditApplications: [],
            egresoAllocations: [],
          },
        ],
      });
    });

    it('revierte el stock, recalcula costo promedio y último costo, y registra el movimiento de anulación', async () => {
      await service.void('doc-1', fullUser);

      expect(applyStockChange).toHaveBeenCalledTimes(1);
      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: -5,
      });
      expect(applyBinStockChange).not.toHaveBeenCalled();
      expect(calculateAvgCostAfterVoid).toHaveBeenCalledWith(
        tx,
        'p1',
        80,
        5,
        100,
        0,
      );
      expect(findLastPurchaseCostAfterVoid).toHaveBeenCalledWith(
        tx,
        'p1',
        'doc-1',
        movement.createdAt,
      );
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgCost: 75, lastCost: 90 },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          warehouseId: 'w1',
          binId: null,
          movementType: MovementType.void,
          quantity: -5,
          unitCost: 100,
          previousStock: 10,
          newStock: 5,
          documentId: 'doc-1',
          documentItemId: 'i1',
          userId: 'u1',
        },
      });
    });

    it('borra la cuenta por pagar y no toca cuentas por cobrar ni créditos', async () => {
      await service.void('doc-1', fullUser);

      expect(tx.accountsPayable.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
      });
      expect(tx.accountsReceivable.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
      });
      expect(tx.supplierCredit.deleteMany).not.toHaveBeenCalled();
      expect(tx.customerCredit.deleteMany).not.toHaveBeenCalled();
      expect(undoCustomerCreditApplications).not.toHaveBeenCalled();
    });

    it('no toca lastCost si hay una compra posterior (el servicio devuelve undefined)', async () => {
      jest.mocked(findLastPurchaseCostAfterVoid).mockResolvedValue(undefined);

      await service.void('doc-1', fullUser);

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgCost: 75 },
      });
    });

    it('lastCost vuelve a 0 si no hay compra previa viva', async () => {
      jest.mocked(findLastPurchaseCostAfterVoid).mockResolvedValue(0);

      await service.void('doc-1', fullUser);

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgCost: 75, lastCost: 0 },
      });
    });

    it('busca consumo posterior excluyendo el documento, traslados y anulaciones', async () => {
      await service.void('doc-1', fullUser);

      expect(tx.inventoryMovement.findFirst).toHaveBeenCalledWith({
        where: {
          productId: 'p1',
          documentId: { not: 'doc-1' },
          quantity: { lt: 0 },
          movementType: { notIn: [MovementType.transfer, MovementType.void] },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('rechaza si el producto tuvo consumo posterior a la compra y no cambia nada', async () => {
      tx.inventoryMovement.findFirst.mockResolvedValue({
        createdAt: new Date('2026-10-02T10:00:00Z'),
      });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(applyStockChange).not.toHaveBeenCalled();
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('permite anular si el último consumo es anterior a la compra', async () => {
      tx.inventoryMovement.findFirst.mockResolvedValue({
        createdAt: new Date('2026-09-30T10:00:00Z'),
      });

      await expect(service.void('doc-1', fullUser)).resolves.toBe(found);
      expect(applyStockChange).toHaveBeenCalledTimes(1);
    });

    it('consulta una sola vez el consumo posterior por producto aunque haya varias líneas', async () => {
      loadDocument(DocumentType.CM, {
        inventoryMovements: [
          makeMovement({ documentItemId: 'i1' }),
          makeMovement({ documentItemId: 'i2', quantity: 2 }),
        ],
      });

      await service.void('doc-1', fullUser);

      expect(tx.inventoryMovement.findFirst).toHaveBeenCalledTimes(1);
      expect(applyStockChange).toHaveBeenCalledTimes(2);
      expect(tx.product.update).toHaveBeenCalledTimes(2);
    });

    it('en bodega tienda valida que quitar el stock no pise reservas', async () => {
      tx.warehouse.findUniqueOrThrow.mockResolvedValue({ type: 'store' });

      await service.void('doc-1', fullUser);

      expect(assertAvailableForReservation).toHaveBeenCalledWith(
        tx,
        'p1',
        'w1',
        5,
        expect.any(Function),
      );
      const buildMessage = jest.mocked(assertAvailableForReservation).mock
        .calls[0][4] as (info: {
        available: number;
        reserved: number;
        requestedQty: number;
      }) => string;
      expect(buildMessage({ available: 2, reserved: 3, requestedQty: 5 })).toBe(
        'No se puede anular: dejaría solo 2 unidades disponibles de PRD-1 (3 ya reservadas por preventas), pero esta anulación movía 5.',
      );
      expect(buildMessage({ available: 2, reserved: 0, requestedQty: 5 })).toBe(
        'No se puede anular: dejaría solo 2 unidades disponibles de PRD-1, pero esta anulación movía 5.',
      );
    });

    it('si pisaría una reserva, no mueve stock ni registra el movimiento', async () => {
      tx.warehouse.findUniqueOrThrow.mockResolvedValue({ type: 'store' });
      jest
        .mocked(assertAvailableForReservation)
        .mockRejectedValue(new ConflictException('reservado'));

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        ConflictException,
      );
      expect(applyStockChange).not.toHaveBeenCalled();
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('en bodegas que no son tienda no valida reservas', async () => {
      await service.void('doc-1', fullUser);

      expect(tx.warehouse.findUniqueOrThrow).toHaveBeenCalledTimes(1);
      expect(assertAvailableForReservation).not.toHaveBeenCalled();
    });

    it('consulta el tipo de bodega una vez por bodega', async () => {
      loadDocument(DocumentType.CM, {
        inventoryMovements: [
          makeMovement({ documentItemId: 'i1' }),
          makeMovement({ documentItemId: 'i2', productId: 'p2' }),
        ],
      });

      await service.void('doc-1', fullUser);

      expect(tx.warehouse.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    });
  });

  describe('ramas por tipo en el cálculo de costo (CM / EAI / resto)', () => {
    it('CM: siempre afecta costo promedio y último costo', async () => {
      loadDocument(DocumentType.CM, {
        inventoryMovements: [makeMovement({ documentItem: null })],
      });

      await service.void('doc-1', fullUser);

      expect(calculateAvgCostAfterVoid).toHaveBeenCalledTimes(1);
      expect(findLastPurchaseCostAfterVoid).toHaveBeenCalledTimes(1);
    });

    it('EAI con costo unitario > 0: revierte solo el costo promedio, nunca el último costo', async () => {
      loadDocument(DocumentType.EAI, {
        inventoryMovements: [
          makeMovement({
            quantity: 4,
            unitCost: 50,
            documentItem: { unitCost: 50 },
          }),
        ],
      });

      await service.void('doc-1', fullUser);

      expect(calculateAvgCostAfterVoid).toHaveBeenCalledWith(
        tx,
        'p1',
        80,
        4,
        50,
        0,
      );
      expect(findLastPurchaseCostAfterVoid).not.toHaveBeenCalled();
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgCost: 75 },
      });
      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: -4,
      });
    });

    it('dos líneas del mismo producto: la segunda descuenta del stock lo ya revertido por la primera', async () => {
      loadDocument(DocumentType.CM, {
        inventoryMovements: [
          makeMovement({ documentItemId: 'i1', quantity: 5, unitCost: 100 }),
          makeMovement({ documentItemId: 'i2', quantity: 2, unitCost: 60 }),
        ],
      });
      tx.product.findUniqueOrThrow
        .mockResolvedValueOnce({ avgCost: 80, code: 'PRD-1' })
        .mockResolvedValueOnce({ avgCost: 75, code: 'PRD-1' });
      jest
        .mocked(calculateAvgCostAfterVoid)
        .mockResolvedValueOnce(75)
        .mockResolvedValueOnce(70);

      await service.void('doc-1', fullUser);

      const calls = jest.mocked(calculateAvgCostAfterVoid).mock.calls;
      expect(calls[0]).toEqual([tx, 'p1', 80, 5, 100, 0]);
      expect(calls[1]).toEqual([tx, 'p1', 75, 2, 60, 5]);
      expect(tx.product.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'p1' },
        data: { avgCost: 70, lastCost: 90 },
      });
    });

    it('EAI con consumo posterior también se rechaza', async () => {
      loadDocument(DocumentType.EAI, {
        inventoryMovements: [makeMovement()],
      });
      tx.inventoryMovement.findFirst.mockResolvedValue({
        createdAt: new Date('2026-10-05T10:00:00Z'),
      });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        ConflictException,
      );
      expect(applyStockChange).not.toHaveBeenCalled();
    });

    it.each([
      ['costo unitario 0', { documentItem: { unitCost: 0 } }],
      ['línea sin documentItem', { documentItem: null }],
    ])('EAI con %s: no toca costos, solo stock', async (_label, overrides) => {
      loadDocument(DocumentType.EAI, {
        inventoryMovements: [makeMovement(overrides)],
      });

      await service.void('doc-1', fullUser);

      expect(tx.inventoryMovement.findFirst).not.toHaveBeenCalled();
      expect(calculateAvgCostAfterVoid).not.toHaveBeenCalled();
      expect(findLastPurchaseCostAfterVoid).not.toHaveBeenCalled();
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: -5,
      });
    });

    it.each([
      [DocumentType.DVV, 2],
      [DocumentType.SAJ, -2],
      [DocumentType.DVC, -2],
      [DocumentType.POS, -2],
      [DocumentType.COT, -2],
    ])(
      '%s: nunca afecta costos aunque la línea tenga costo',
      async (type, quantity) => {
        loadDocument(type, {
          inventoryMovements: [makeMovement({ quantity })],
        });

        await service.void('doc-1', fullUser);

        expect(tx.inventoryMovement.findFirst).not.toHaveBeenCalled();
        expect(calculateAvgCostAfterVoid).not.toHaveBeenCalled();
        expect(findLastPurchaseCostAfterVoid).not.toHaveBeenCalled();
        expect(tx.product.update).not.toHaveBeenCalled();
      },
    );
  });
});
