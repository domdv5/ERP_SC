import { DocumentType, MovementType } from '@/common/enums';
import { undoCustomerCreditApplications } from './helpers/customer-credit.helpers';
import { assertAvailableForReservation } from './helpers/reservation.helpers';
import { applyBinStockChange, applyStockChange } from './helpers/stock.helpers';
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

describe('DocumentsService.void: stock por tipo', () => {
  const harness = createVoidHarness();
  const { tx, service, loadDocument } = harness;

  beforeEach(() => {
    resetVoidHarness(harness);
  });

  describe('ajustes (EAI / SAJ)', () => {
    it('SAJ: la salida se revierte devolviendo el stock y se registra la anulación', async () => {
      loadDocument(DocumentType.SAJ, {
        inventoryMovements: [makeMovement({ quantity: -2, unitCost: 40 })],
      });

      await service.void('doc-1', fullUser);

      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: 2,
      });
      expect(applyBinStockChange).not.toHaveBeenCalled();
      expect(assertAvailableForReservation).not.toHaveBeenCalled();
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          movementType: MovementType.void,
          quantity: 2,
          unitCost: 40,
          documentId: 'doc-1',
        }),
      });
    });

    it('EAI en bodega tienda valida reservas antes de quitar el stock', async () => {
      loadDocument(DocumentType.EAI, {
        inventoryMovements: [makeMovement({ documentItem: { unitCost: 0 } })],
      });
      tx.warehouse.findUniqueOrThrow.mockResolvedValue({ type: 'store' });

      await service.void('doc-1', fullUser);

      expect(assertAvailableForReservation).toHaveBeenCalledWith(
        tx,
        'p1',
        'w1',
        5,
        expect.any(Function),
      );
    });
  });

  describe('ventas con salida de inventario (POS / COT)', () => {
    it('POS: devuelve el stock a la bodega y restituye los saldos a favor aplicados', async () => {
      loadDocument(DocumentType.POS, {
        inventoryMovements: [makeMovement({ quantity: -3, unitCost: 60 })],
        appliedCustomerCredits: [{ id: 'ac1' }],
      });

      await service.void('doc-1', fullUser);

      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: 3,
      });
      expect(assertAvailableForReservation).not.toHaveBeenCalled();
      expect(undoCustomerCreditApplications).toHaveBeenCalledWith(tx, 'doc-1');
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          movementType: MovementType.void,
          quantity: 3,
          previousStock: 10,
          newStock: 5,
        }),
      });
    });

    it('POS sin saldos a favor aplicados no llama a undoCustomerCreditApplications', async () => {
      loadDocument(DocumentType.POS, {
        inventoryMovements: [makeMovement({ quantity: -3 })],
      });

      await service.void('doc-1', fullUser);

      expect(undoCustomerCreditApplications).not.toHaveBeenCalled();
    });

    it('COT: devuelve el stock, borra la CxC y restituye saldos a favor', async () => {
      loadDocument(DocumentType.COT, {
        inventoryMovements: [makeMovement({ quantity: -1 })],
        accountsReceivable: [
          { receivablePayments: [], reciboCajaAllocations: [] },
        ],
        appliedCustomerCredits: [{ id: 'ac1' }, { id: 'ac2' }],
      });

      await service.void('doc-1', fullUser);

      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: 1,
      });
      expect(tx.accountsReceivable.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
      });
      expect(undoCustomerCreditApplications).toHaveBeenCalledTimes(1);
      expect(undoCustomerCreditApplications).toHaveBeenCalledWith(tx, 'doc-1');
    });

    it('anula tras borrar las cuentas: la restitución de créditos ocurre al final', async () => {
      loadDocument(DocumentType.COT, {
        appliedCustomerCredits: [{ id: 'ac1' }],
      });

      await service.void('doc-1', fullUser);

      const deleteOrder =
        tx.accountsReceivable.deleteMany.mock.invocationCallOrder[0];
      const undoOrder = jest.mocked(undoCustomerCreditApplications).mock
        .invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(undoOrder);
    });
  });

  describe('documentos oficiales sin stock (POSO / CMO)', () => {
    it.each([DocumentType.POSO, DocumentType.CMO])(
      '%s: solo cambia el estado; no mueve stock, costos ni libera reservas',
      async (type) => {
        loadDocument(type);

        await service.void('doc-1', fullUser);

        expect(tx.document.updateMany).toHaveBeenCalledTimes(1);
        expect(applyStockChange).not.toHaveBeenCalled();
        expect(applyBinStockChange).not.toHaveBeenCalled();
        expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
        expect(tx.product.update).not.toHaveBeenCalled();
        expect(tx.reservationRelease.createMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('devoluciones (DVC / DVV)', () => {
    it('DVC: devuelve el stock que salió y borra la nota crédito del proveedor', async () => {
      loadDocument(DocumentType.DVC, {
        inventoryMovements: [makeMovement({ quantity: -4 })],
        supplierCredits: [{ applications: [] }],
      });

      await service.void('doc-1', fullUser);

      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: 4,
      });
      expect(tx.supplierCredit.deleteMany).toHaveBeenCalledWith({
        where: { sourceDocumentId: 'doc-1' },
      });
      expect(tx.customerCredit.deleteMany).not.toHaveBeenCalled();
    });

    it('DVV: quita el stock que entró y borra el saldo a favor del cliente', async () => {
      loadDocument(DocumentType.DVV, {
        inventoryMovements: [makeMovement({ quantity: 2 })],
        customerCredits: [{ applications: [] }],
      });

      await service.void('doc-1', fullUser);

      expect(applyStockChange).toHaveBeenCalledWith(tx, {
        productId: 'p1',
        warehouseId: 'w1',
        delta: -2,
      });
      expect(tx.customerCredit.deleteMany).toHaveBeenCalledWith({
        where: { sourceDocumentId: 'doc-1' },
      });
      expect(tx.supplierCredit.deleteMany).not.toHaveBeenCalled();
    });

    it('DVV en bodega tienda valida reservas antes de quitar el stock', async () => {
      loadDocument(DocumentType.DVV, {
        inventoryMovements: [makeMovement({ quantity: 2 })],
      });
      tx.warehouse.findUniqueOrThrow.mockResolvedValue({ type: 'store' });

      await service.void('doc-1', fullUser);

      expect(assertAvailableForReservation).toHaveBeenCalledWith(
        tx,
        'p1',
        'w1',
        2,
        expect.any(Function),
      );
    });
  });

  describe('traslados (T): BinStock e Inventory se mueven juntos', () => {
    beforeEach(() => {
      loadDocument(DocumentType.T, {
        inventoryMovements: [
          makeMovement({
            warehouseId: 'w-origin',
            binId: 'bin-o',
            quantity: -3,
            documentItemId: 'i1',
          }),
          makeMovement({
            warehouseId: 'w-dest',
            binId: 'bin-d',
            quantity: 3,
            documentItemId: 'i1',
          }),
        ],
      });
    });

    it('revierte origen y destino con el mismo delta en stock y en bulto', async () => {
      await service.void('doc-1', fullUser);

      expect(applyStockChange).toHaveBeenNthCalledWith(1, tx, {
        productId: 'p1',
        warehouseId: 'w-origin',
        delta: 3,
      });
      expect(applyStockChange).toHaveBeenNthCalledWith(2, tx, {
        productId: 'p1',
        warehouseId: 'w-dest',
        delta: -3,
      });
      expect(applyBinStockChange).toHaveBeenCalledTimes(2);
      expect(applyBinStockChange).toHaveBeenNthCalledWith(1, tx, {
        productId: 'p1',
        binId: 'bin-o',
        warehouseId: 'w-origin',
        delta: 3,
      });
      expect(applyBinStockChange).toHaveBeenNthCalledWith(2, tx, {
        productId: 'p1',
        binId: 'bin-d',
        warehouseId: 'w-dest',
        delta: -3,
      });
    });

    it('registra los movimientos de anulación con su bulto y sin tocar costos', async () => {
      await service.void('doc-1', fullUser);

      expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
      expect(tx.inventoryMovement.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          warehouseId: 'w-origin',
          binId: 'bin-o',
          movementType: MovementType.void,
          quantity: 3,
        }),
      });
      expect(tx.inventoryMovement.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          warehouseId: 'w-dest',
          binId: 'bin-d',
          movementType: MovementType.void,
          quantity: -3,
        }),
      });
      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it('valida reservas solo en la bodega tienda que perdería stock', async () => {
      tx.warehouse.findUniqueOrThrow.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve({
            type: where.id === 'w-dest' ? 'store' : 'general',
          }),
      );

      await service.void('doc-1', fullUser);

      expect(assertAvailableForReservation).toHaveBeenCalledTimes(1);
      expect(assertAvailableForReservation).toHaveBeenCalledWith(
        tx,
        'p1',
        'w-dest',
        3,
        expect.any(Function),
      );
    });
  });
});
