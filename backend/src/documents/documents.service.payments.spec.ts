import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { DocumentsService } from './documents.service';
import { DocumentsQueryService } from './documents-query.service';
import { DocumentEffectsRegistry } from './strategies/document-effects.registry';

const user = {
  sub: 'u1',
  permissions: ['document.create.POS'],
} as unknown as JwtPayload;

describe('DocumentsService: formas de pago del borrador', () => {
  const tx = {
    document: { update: jest.fn(), delete: jest.fn() },
    documentItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    documentPayment: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    document: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const registry = {
    get: jest.fn(() => ({
      usesTodayDate: true,
      tracksCustomerBranch: true,
      resolveItemAddedAt: (_requested: string | undefined, now: Date) => now,
    })),
  };
  const documentsQuery = new DocumentsQueryService(
    prisma as unknown as PrismaService,
  );
  const service = new DocumentsService(
    prisma as unknown as PrismaService,
    registry as unknown as DocumentEffectsRegistry,
    {} as SequenceService,
    documentsQuery,
  );
  const draft = {
    id: 'doc-1',
    type: DocumentType.POS,
    status: DocumentStatus.draft,
    derivedDocuments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.document.findUnique.mockResolvedValue(draft);
    tx.document.update.mockResolvedValue({ ...draft, derivedDocuments: [] });
  });

  it('update reemplaza las líneas de pago y no las manda como columna', async () => {
    const payments = [
      { method: 'efectivo_almacen', amount: 60000 },
      { method: 'consignacion_almacen', amount: 40000 },
    ];

    await service.update('doc-1', { payments } as never, user);

    expect(tx.documentPayment.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
    expect(tx.documentPayment.createMany).toHaveBeenCalledWith({
      data: payments.map((p) => ({ documentId: 'doc-1', ...p })),
    });
    expect(tx.document.update.mock.calls[0][0].data).not.toHaveProperty(
      'payments',
    );
  });

  it('update sin payments no toca las líneas de pago', async () => {
    await service.update('doc-1', { notes: 'ajuste' }, user);

    expect(tx.documentPayment.deleteMany).not.toHaveBeenCalled();
    expect(tx.documentPayment.createMany).not.toHaveBeenCalled();
  });

  it('remove borra las líneas de pago antes del documento', async () => {
    await service.remove('doc-1', user);

    expect(tx.documentPayment.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
    expect(
      tx.documentPayment.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.document.delete.mock.invocationCallOrder[0]);
  });
});
