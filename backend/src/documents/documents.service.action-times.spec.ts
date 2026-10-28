import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { DocumentsService } from './documents.service';
import { DocumentsQueryService } from './documents-query.service';
import { DocumentEffectsRegistry } from './strategies/document-effects.registry';

const user = {
  sub: 'u1',
  permissions: ['document.create.PV'],
} as unknown as JwtPayload;

describe('DocumentsService: hora de cada acción', () => {
  const tx = {
    document: { updateMany: jest.fn(), update: jest.fn() },
    documentItem: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    document: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const registry = {
    get: jest.fn(() => ({
      confirm: jest.fn(),
      usesTodayDate: false,
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
    type: DocumentType.PV,
    status: DocumentStatus.draft,
    sourceDocumentId: null,
    documentItems: [{ productId: 'p1', quantity: 1 }],
    derivedDocuments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.document.findUnique.mockResolvedValue(draft);
    tx.document.updateMany.mockResolvedValue({ count: 1 });
    tx.document.update.mockResolvedValue({ ...draft, derivedDocuments: [] });
  });

  it('confirm guarda quién y cuándo confirmó', async () => {
    await service.confirm('doc-1', undefined, user);

    const { data } = tx.document.updateMany.mock.calls[0][0];
    expect(data.confirmedById).toBe('u1');
    expect(data.confirmedAt).toBeInstanceOf(Date);
  });

  it('update guarda quién y cuándo editó', async () => {
    await service.update('doc-1', { notes: 'ajuste' }, user);

    const { data } = tx.document.update.mock.calls[0][0];
    expect(data.updatedById).toBe('u1');
    expect(data.editedAt).toBeInstanceOf(Date);
  });
});
