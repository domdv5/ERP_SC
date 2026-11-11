import { DocumentStatus, DocumentType } from '@/common/enums';
import { applyStockChange } from './helpers/stock.helpers';
import {
  createVoidHarness,
  fullUser,
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

describe('DocumentsService.void: reservas y conversión', () => {
  const harness = createVoidHarness();
  const { tx, service, found, loadDocument, rawSql } = harness;

  beforeEach(() => {
    resetVoidHarness(harness);
  });

  describe('reservas (PV / REM)', () => {
    it.each([DocumentType.PV, DocumentType.REM])(
      '%s: libera lo pendiente de cada línea (cantidad - liberada - convertida)',
      async (type) => {
        loadDocument(type);
        tx.documentItem.findMany.mockResolvedValue([
          { id: 'i1', quantity: 10, releasedQuantity: 2, convertedQuantity: 3 },
          { id: 'i2', quantity: 4, releasedQuantity: 4, convertedQuantity: 0 },
          { id: 'i3', quantity: 6, releasedQuantity: 0, convertedQuantity: 0 },
        ]);

        await service.void('doc-1', fullUser);

        expect(tx.documentItem.findMany).toHaveBeenCalledWith({
          where: { documentId: 'doc-1' },
          select: {
            id: true,
            quantity: true,
            releasedQuantity: true,
            convertedQuantity: true,
          },
        });
        expect(tx.reservationRelease.createMany).toHaveBeenCalledWith({
          data: [
            {
              documentItemId: 'i1',
              quantity: 5,
              userId: 'u1',
              notes: 'Liberación automática por anulación del documento',
            },
            {
              documentItemId: 'i3',
              quantity: 6,
              userId: 'u1',
              notes: 'Liberación automática por anulación del documento',
            },
          ],
        });
        expect(applyStockChange).not.toHaveBeenCalled();
      },
    );

    it('no crea liberaciones si la reserva ya estaba liberada o convertida del todo', async () => {
      loadDocument(DocumentType.PV);
      tx.documentItem.findMany.mockResolvedValue([
        { id: 'i1', quantity: 5, releasedQuantity: 2, convertedQuantity: 3 },
      ]);

      await service.void('doc-1', fullUser);

      expect(tx.reservationRelease.createMany).not.toHaveBeenCalled();
    });

    it('PV con ventas derivadas ya anuladas sí se puede anular', async () => {
      loadDocument(DocumentType.PV, {
        derivedDocuments: [{ id: 'd1', status: DocumentStatus.voided }],
      });

      await expect(service.void('doc-1', fullUser)).resolves.toBe(found);
      expect(tx.document.updateMany).toHaveBeenCalledTimes(1);
    });

    it('los tipos que no son reserva no releen líneas ni crean liberaciones', async () => {
      loadDocument(DocumentType.POS);

      await service.void('doc-1', fullUser);

      expect(tx.documentItem.findMany).not.toHaveBeenCalled();
      expect(tx.reservationRelease.createMany).not.toHaveBeenCalled();
    });
  });

  describe('documento nacido de una conversión', () => {
    const convertedSale = (overrides: Record<string, unknown> = {}) =>
      loadDocument(DocumentType.POS, {
        sourceDocumentId: 'pv-1',
        documentItems: [
          { id: 'i1', productId: 'p1', quantity: 2 },
          { id: 'i2', productId: 'p2', quantity: 3 },
        ],
        ...overrides,
      });

    const conversionUpdates = () =>
      rawSql().filter((statement) => statement.includes('converted_quantity'));

    const sourceRow = (
      id: string,
      productId: string,
      convertedQuantity: number,
    ) => ({
      id,
      productId,
      quantity: 20,
      releasedQuantity: 0,
      convertedQuantity,
    });

    const conversionArgs = () =>
      tx.$queryRaw.mock.calls
        .filter((call) =>
          (call[0] as string[]).join('?').includes('converted_quantity'),
        )
        .map((call) => call.slice(1));

    it('devuelve al origen PV las unidades convertidas de cada producto', async () => {
      convertedSale();
      tx.document.findUnique.mockResolvedValue({ type: DocumentType.PV });
      tx.documentItem.findMany.mockResolvedValue([
        sourceRow('src-1', 'p1', 2),
        sourceRow('src-2', 'p2', 3),
      ]);

      await service.void('doc-1', fullUser);

      expect(tx.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'pv-1' },
        select: { type: true },
      });
      expect(tx.documentItem.findMany).toHaveBeenCalledWith({
        where: { documentId: 'pv-1' },
        orderBy: { id: 'asc' },
      });
      expect(conversionArgs()).toEqual([
        [2, 'src-1'],
        [3, 'src-2'],
      ]);
    });

    it('también aplica cuando el origen es una REM', async () => {
      convertedSale();
      tx.document.findUnique.mockResolvedValue({ type: DocumentType.REM });
      tx.documentItem.findMany.mockResolvedValue([
        sourceRow('src-1', 'p1', 2),
        sourceRow('src-2', 'p2', 3),
      ]);

      await service.void('doc-1', fullUser);

      expect(conversionUpdates()).toHaveLength(2);
    });

    it('REM con el producto en varias filas: devuelve lo convertido a cada fila, no todo a la primera', async () => {
      convertedSale({
        documentItems: [
          { id: 'i1', productId: 'pD', quantity: 20 },
          { id: 'i2', productId: 'pA', quantity: 20 },
          { id: 'i3', productId: 'pD', quantity: 20 },
        ],
      });
      tx.document.findUnique.mockResolvedValue({ type: DocumentType.REM });
      tx.documentItem.findMany.mockResolvedValue([
        sourceRow('src-1', 'pD', 20),
        sourceRow('src-2', 'pA', 20),
        sourceRow('src-3', 'pD', 20),
      ]);

      await service.void('doc-1', fullUser);

      expect(conversionArgs()).toEqual([
        [20, 'src-1'],
        [20, 'src-2'],
        [20, 'src-3'],
      ]);
    });

    it('omite las líneas cuyo producto ya no está en el origen', async () => {
      convertedSale();
      tx.document.findUnique.mockResolvedValue({ type: DocumentType.PV });
      tx.documentItem.findMany.mockResolvedValue([sourceRow('src-2', 'p2', 3)]);

      await service.void('doc-1', fullUser);

      expect(conversionArgs()).toEqual([[3, 'src-2']]);
    });

    it('no devuelve nada si el origen no es una reserva', async () => {
      convertedSale();
      tx.document.findUnique.mockResolvedValue({ type: DocumentType.COT });

      await service.void('doc-1', fullUser);

      expect(conversionUpdates()).toHaveLength(0);
      expect(conversionUpdates()).toHaveLength(0);
    });

    it('no devuelve nada si el origen ya no existe', async () => {
      convertedSale();
      tx.document.findUnique.mockResolvedValue(null);

      await service.void('doc-1', fullUser);

      expect(conversionUpdates()).toHaveLength(0);
      expect(conversionUpdates()).toHaveLength(0);
    });

    it('un documento sin origen no consulta el origen', async () => {
      loadDocument(DocumentType.POS);

      await service.void('doc-1', fullUser);

      expect(tx.document.findUnique).not.toHaveBeenCalled();
    });
  });
});
