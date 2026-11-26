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

const voidedSupplierPayment = { supplierPayment: { voidedAt: new Date() } };
const liveSupplierPayment = { supplierPayment: { voidedAt: null } };
const payable = (overrides: Record<string, unknown>) => ({
  creditApplications: [],
  supplierPaymentAllocations: [],
  ...overrides,
});

describe('DocumentsService.void: egresos anulados no bloquean', () => {
  const harness = createVoidHarness();
  const { tx, prisma, service, loadDocument } = harness;

  beforeEach(() => {
    resetVoidHarness(harness);
  });

  it('anula una CM cuya CxP solo tiene abonos de egresos anulados y borra esas filas', async () => {
    loadDocument(DocumentType.CM, {
      accountsPayable: [
        payable({
          supplierPaymentAllocations: [voidedSupplierPayment],
          creditApplications: [voidedSupplierPayment],
        }),
      ],
    });
    tx.accountsPayable.findMany.mockResolvedValue([
      payable({ supplierPaymentAllocations: [voidedSupplierPayment] }),
    ]);

    await expect(service.void('doc-1', fullUser)).resolves.toBeDefined();

    // Solo borra filas de egresos anulados: una vigente debe quedar para que la FK aborte.
    expect(tx.supplierPaymentAllocation.deleteMany).toHaveBeenCalledWith({
      where: {
        accountPayable: { documentId: 'doc-1' },
        supplierPayment: { voidedAt: { not: null } },
      },
    });
    expect(tx.accountsPayable.deleteMany).toHaveBeenCalled();
  });

  it('sigue bloqueando una CM con un abono de un egreso vigente', async () => {
    loadDocument(DocumentType.CM, {
      accountsPayable: [
        payable({
          supplierPaymentAllocations: [
            voidedSupplierPayment,
            liveSupplierPayment,
          ],
        }),
      ],
    });

    await expect(service.void('doc-1', fullUser)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('anula una DVC cuyo saldo solo se usó en egresos anulados', async () => {
    loadDocument(DocumentType.DVC, {
      supplierCredits: [{ applications: [voidedSupplierPayment] }],
    });
    tx.supplierCredit.findUnique.mockResolvedValue({
      applications: [voidedSupplierPayment],
    });

    await expect(service.void('doc-1', fullUser)).resolves.toBeDefined();

    expect(tx.supplierCreditApplication.deleteMany).toHaveBeenCalledWith({
      where: {
        supplierCredit: { sourceDocumentId: 'doc-1' },
        supplierPayment: { voidedAt: { not: null } },
      },
    });
    expect(tx.supplierCredit.deleteMany).toHaveBeenCalled();
  });

  it('sigue bloqueando una DVC con una aplicación de un egreso vigente o un pago histórico (sin egreso)', async () => {
    for (const application of [
      liveSupplierPayment,
      { supplierPayment: null },
    ]) {
      loadDocument(DocumentType.DVC, {
        supplierCredits: [
          { applications: [voidedSupplierPayment, application] },
        ],
      });

      await expect(service.void('doc-1', fullUser)).rejects.toThrow(
        ConflictException,
      );
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
