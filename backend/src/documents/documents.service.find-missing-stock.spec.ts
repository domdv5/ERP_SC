import { NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { DocumentsService } from './documents.service';
import { DocumentEffectsRegistry } from './strategies/document-effects.registry';

const user = {
  sub: 'u1',
  permissions: ['document.create.POS', 'document.create.CM'],
} as unknown as JwtPayload;

const missingStock = [
  { productId: 'p1', code: 'PRD-1', available: 2, requested: 5 },
];

const makeDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  type: DocumentType.POS,
  status: DocumentStatus.draft,
  warehouseId: 'wh-1',
  documentItems: [{ productId: 'p1', quantity: 5 }],
  ...overrides,
});

describe('DocumentsService.findMissingStock', () => {
  const findUnique = jest.fn();
  const get = jest.fn();
  const prisma = { document: { findUnique } } as unknown as PrismaService;
  const registry = { get } as unknown as DocumentEffectsRegistry;
  const service = new DocumentsService(
    prisma,
    registry,
    {} as unknown as SequenceService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('lanza 404 si el documento no existe', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.findMissingStock('x', user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('devuelve [] si el documento no es borrador', async () => {
    findUnique.mockResolvedValue(
      makeDocument({ status: DocumentStatus.confirmed }),
    );

    await expect(service.findMissingStock('doc-1', user)).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('devuelve [] si la estrategia del tipo no implementa findMissingStock', async () => {
    findUnique.mockResolvedValue(makeDocument({ type: DocumentType.CM }));
    get.mockReturnValue({ type: DocumentType.CM });

    await expect(service.findMissingStock('doc-1', user)).resolves.toEqual([]);
  });

  it('devuelve el resultado de la estrategia llamándola con (prisma, document)', async () => {
    const document = makeDocument();
    const findMissingStock = jest.fn().mockResolvedValue(missingStock);
    findUnique.mockResolvedValue(document);
    get.mockReturnValue({ type: DocumentType.POS, findMissingStock });

    await expect(service.findMissingStock('doc-1', user)).resolves.toBe(
      missingStock,
    );
    expect(findMissingStock).toHaveBeenCalledWith(prisma, document);
  });
});
