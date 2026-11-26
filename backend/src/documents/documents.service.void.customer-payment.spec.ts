import { ConflictException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
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

const voidedCustomerPayment = { customerPayment: { voidedAt: new Date() } };
const liveCustomerPayment = { customerPayment: { voidedAt: null } };
const receivable = (overrides: Record<string, unknown>) => ({
  paidAmount: 0,
  customerPaymentAllocations: [],
  ...overrides,
});

describe('DocumentsService.void: recibos anulados no bloquean', () => {
  const harness = createVoidHarness();
  const { tx, prisma, service, loadDocument } = harness;

  beforeEach(() => {
    resetVoidHarness(harness);
  });

  it('anula una COT cuyo único recibo fue anulado y borra solo las filas de recibos anulados', async () => {
    loadDocument(DocumentType.COT, {
      accountsReceivable: [
        receivable({ customerPaymentAllocations: [voidedCustomerPayment] }),
      ],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable({ customerPaymentAllocations: [voidedCustomerPayment] }),
    ]);

    await expect(service.void('doc-1', fullUser)).resolves.toBeDefined();

    // Una fila de recibo vigente debe quedar para que la FK aborte la anulación.
    const onlyVoided = {
      where: {
        accountReceivable: { documentId: 'doc-1' },
        customerPayment: { voidedAt: { not: null } },
      },
    };
    expect(tx.customerPaymentAllocation.deleteMany).toHaveBeenCalledWith(
      onlyVoided,
    );
    expect(tx.customerCreditApplication.deleteMany).toHaveBeenCalledWith(
      onlyVoided,
    );
    expect(tx.accountsReceivable.deleteMany).toHaveBeenCalled();
  });

  it('sigue bloqueando una COT con un abono de un recibo vigente', async () => {
    loadDocument(DocumentType.COT, {
      accountsReceivable: [
        receivable({
          customerPaymentAllocations: [
            voidedCustomerPayment,
            liveCustomerPayment,
          ],
        }),
      ],
    });

    await expect(service.void('doc-1', fullUser)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sigue bloqueando si un recibo vigente aparece justo antes de borrar la CxC', async () => {
    loadDocument(DocumentType.COT, {
      accountsReceivable: [
        receivable({ customerPaymentAllocations: [voidedCustomerPayment] }),
      ],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable({ customerPaymentAllocations: [liveCustomerPayment] }),
    ]);

    await expect(service.void('doc-1', fullUser)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.accountsReceivable.deleteMany).not.toHaveBeenCalled();
  });

  it('sigue bloqueando una COT con dinero abonado aunque sus recibos estén anulados', async () => {
    loadDocument(DocumentType.COT, {
      accountsReceivable: [
        receivable({
          paidAmount: 1000,
          customerPaymentAllocations: [voidedCustomerPayment],
        }),
      ],
    });

    await expect(service.void('doc-1', fullUser)).rejects.toThrow(
      ConflictException,
    );
  });

  it('anula una DVV cuyo saldo solo se usó en recibos anulados y borra esas aplicaciones', async () => {
    loadDocument(DocumentType.DVV, {
      customerCredits: [{ applications: [voidedCustomerPayment] }],
    });

    await expect(service.void('doc-1', fullUser)).resolves.toBeDefined();

    expect(tx.customerCreditApplication.deleteMany).toHaveBeenCalledWith({
      where: {
        customerCredit: { sourceDocumentId: 'doc-1' },
        customerPayment: { voidedAt: { not: null } },
      },
    });
    expect(tx.customerCredit.deleteMany).toHaveBeenCalled();
  });

  it('sigue bloqueando una DVV con una aplicación de un recibo vigente o de una venta', async () => {
    for (const application of [
      liveCustomerPayment,
      { customerPayment: null },
    ]) {
      loadDocument(DocumentType.DVV, {
        customerCredits: [
          { applications: [voidedCustomerPayment, application] },
        ],
      });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        ConflictException,
      );
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
