import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, DocumentType } from '@/common/enums';
import { applyStockChange } from './helpers/stock.helpers';
import {
  createVoidHarness,
  fullUser,
  makeMovement,
  makeUser,
  resetVoidHarness,
  SALE_TYPES,
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

describe('DocumentsService.void: validaciones y estado', () => {
  const harness = createVoidHarness();
  const { tx, prisma, service, documentsQuery, found, loadDocument, rawSql } =
    harness;

  beforeEach(() => {
    resetVoidHarness(harness);
  });

  describe('validaciones previas a la transacción', () => {
    it('lanza 404 si el documento no existe', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        new NotFoundException('Documento no encontrado'),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('un tipo de venta exige document.void.{TIPO}, no basta con crear', async () => {
      loadDocument(DocumentType.POS);

      await expect(
        service.void('doc-1', makeUser(['document.create.POS'])),
      ).rejects.toThrow(
        new ForbiddenException(
          'No tiene permiso para anular documentos de tipo POS',
        ),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(SALE_TYPES)(
      'permite anular %s con document.void.{TIPO} sin permiso de crear',
      async (type) => {
        loadDocument(type);

        await expect(
          service.void('doc-1', makeUser([`document.void.${type}`])),
        ).resolves.toBe(found);
      },
    );

    it('un tipo que no es venta se anula con el permiso de crear, no con el de anular', async () => {
      loadDocument(DocumentType.CM);

      await expect(
        service.void('doc-1', makeUser(['document.void.CM'])),
      ).rejects.toThrow(
        new ForbiddenException(
          'No tiene permiso para crear documentos de tipo CM',
        ),
      );

      await expect(
        service.void('doc-1', makeUser(['document.create.CM'])),
      ).resolves.toBe(found);
    });

    it.each([DocumentStatus.voided, DocumentStatus.draft])(
      'rechaza con 409 un documento en estado %s',
      async (status) => {
        loadDocument(DocumentType.CM, { status });

        await expect(service.void('doc-1', fullUser)).rejects.toThrow(
          new ConflictException('Solo se pueden anular documentos confirmados'),
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it.each([DocumentType.PV, DocumentType.REM])(
      'rechaza anular %s con una venta derivada activa',
      async (type) => {
        loadDocument(type, {
          derivedDocuments: [
            { id: 'd1', status: DocumentStatus.voided },
            { id: 'd2', status: DocumentStatus.confirmed },
          ],
        });

        await expect(service.void('doc-1', fullUser)).rejects.toThrow(
          new ConflictException(
            'No se puede anular: este documento fue convertido a una venta. Anule primero el documento de venta derivado.',
          ),
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('rechaza una cuenta por pagar con pagos, notas crédito aplicadas o egresos', async () => {
      const empty = {
        payablePayments: [],
        creditApplications: [],
        egresoAllocations: [],
      };
      for (const used of [
        { payablePayments: [{ id: 'x' }] },
        { creditApplications: [{ id: 'x' }] },
        { egresoAllocations: [{ id: 'x' }] },
      ]) {
        loadDocument(DocumentType.CM, {
          accountsPayable: [{ ...empty, ...used }],
        });

        await expect(service.void('doc-1', fullUser)).rejects.toThrow(
          new ConflictException(
            'No se puede anular: la cuenta por pagar ya tiene pagos registrados',
          ),
        );
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una DVC cuya nota crédito ya se aplicó', async () => {
      loadDocument(DocumentType.DVC, {
        supplierCredits: [{ applications: [{ id: 'a1' }] }],
      });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        new ConflictException(
          'No se puede anular: la nota crédito generada por este documento ya fue aplicada a un pago',
        ),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una DVV cuyo saldo a favor ya se aplicó', async () => {
      loadDocument(DocumentType.DVV, {
        customerCredits: [{ applications: [{ id: 'a1' }] }],
      });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        new ConflictException(
          'No se puede anular: el saldo a favor generado por esta devolución ya fue aplicado en una venta',
        ),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta por cobrar con pagos o recibos de caja', async () => {
      for (const used of [
        { receivablePayments: [{ id: 'x' }], reciboCajaAllocations: [] },
        { receivablePayments: [], reciboCajaAllocations: [{ id: 'x' }] },
      ]) {
        loadDocument(DocumentType.COT, { accountsReceivable: [used] });

        await expect(service.void('doc-1', fullUser)).rejects.toThrow(
          new ConflictException(
            'No se puede anular: la cuenta por cobrar ya tiene pagos registrados',
          ),
        );
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('dentro de la transacción: estado y re-chequeos', () => {
    it('marca el documento como anulado con quién y cuándo', async () => {
      loadDocument(DocumentType.POSO);

      const result = await service.void('doc-1', fullUser);

      expect(tx.document.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', status: DocumentStatus.confirmed },
        data: {
          status: DocumentStatus.voided,
          voidedById: 'u1',
          voidedAt: expect.any(Date),
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 30000,
      });
      expect(documentsQuery.findOne).toHaveBeenCalledWith('doc-1');
      expect(result).toBe(found);
    });

    it('lanza 409 si otro proceso anuló el documento antes (claim sin filas)', async () => {
      loadDocument(DocumentType.CM, {
        inventoryMovements: [makeMovement()],
      });
      tx.document.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        new ConflictException('Solo se pueden anular documentos confirmados'),
      );
      expect(applyStockChange).not.toHaveBeenCalled();
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('bloquea con FOR UPDATE las cuentas y la nota crédito del documento', async () => {
      loadDocument(DocumentType.DVC);

      await service.void('doc-1', fullUser);

      const sql = rawSql();
      expect(sql).toHaveLength(3);
      expect(sql[0]).toContain('accounts_payable');
      expect(sql[1]).toContain('accounts_receivable');
      expect(sql[2]).toContain('supplier_credit');
      sql.forEach((statement) => expect(statement).toContain('FOR UPDATE'));
    });

    it('lanza 409 si un egreso concurrente pagó la cuenta por pagar', async () => {
      loadDocument(DocumentType.CM);
      tx.accountsPayable.findMany.mockResolvedValue([
        {
          payablePayments: [],
          creditApplications: [],
          egresoAllocations: [{ id: 'e1' }],
        },
      ]);

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        new ConflictException(
          'No se puede anular: la cuenta por pagar ya tiene pagos registrados',
        ),
      );
      expect(tx.accountsPayable.deleteMany).not.toHaveBeenCalled();
    });

    it('lanza 409 si un recibo de caja concurrente pagó la cuenta por cobrar', async () => {
      loadDocument(DocumentType.COT);
      tx.accountsReceivable.findMany.mockResolvedValue([
        { receivablePayments: [], reciboCajaAllocations: [{ id: 'r1' }] },
      ]);

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        new ConflictException(
          'No se puede anular: la cuenta por cobrar ya tiene pagos registrados',
        ),
      );
      expect(tx.accountsReceivable.deleteMany).not.toHaveBeenCalled();
    });

    it('lanza 409 si la nota crédito se aplicó entre el chequeo y el lock', async () => {
      loadDocument(DocumentType.DVC, {
        supplierCredits: [{ applications: [] }],
      });
      tx.supplierCredit.findUnique.mockResolvedValue({
        applications: [{ id: 'a1' }],
      });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        new ConflictException(
          'No se puede anular: la nota crédito generada por este documento ya fue aplicada a un pago',
        ),
      );
      expect(tx.supplierCredit.findUnique).toHaveBeenCalledWith({
        where: { sourceDocumentId: 'doc-1' },
        include: { applications: true },
      });
      expect(tx.supplierCredit.deleteMany).not.toHaveBeenCalled();
    });
  });
});
