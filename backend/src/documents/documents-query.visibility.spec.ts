import { ForbiddenException } from '@nestjs/common';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { DocumentsQueryService } from './documents-query.service';

describe('DocumentsQueryService: detalle y PDF respetan los tipos visibles del rol', () => {
  const prisma = { document: { findUnique: jest.fn() } };
  const service = new DocumentsQueryService(prisma as unknown as PrismaService);
  const userWith = (...permissions: string[]) =>
    ({ sub: 'u1', permissions }) as unknown as JwtPayload;
  const cm = {
    id: 'doc-1',
    type: DocumentType.CM,
    status: DocumentStatus.confirmed,
    documentItems: [],
    derivedDocuments: [],
  };

  beforeEach(() => {
    prisma.document.findUnique.mockReset().mockResolvedValue(cm);
  });

  it('el detalle de un tipo fuera del rol da 403', async () => {
    await expect(
      service.findOneForUser('doc-1', userWith('document.create.T')),
    ).rejects.toThrow(
      new ForbiddenException('No tiene permiso para ver documentos de tipo CM'),
    );
  });

  it('el detalle de un tipo del rol se devuelve', async () => {
    await expect(
      service.findOneForUser('doc-1', userWith('document.create.CM')),
    ).resolves.toMatchObject({ id: 'doc-1' });
  });

  it('con ap.read se ve cualquier tipo', async () => {
    await expect(
      service.findOneForUser('doc-1', userWith('ap.read')),
    ).resolves.toMatchObject({ id: 'doc-1' });
  });

  it('el PDF de un tipo fuera del rol da 403', async () => {
    await expect(
      service.getDocumentForPrint('doc-1', userWith('document.create.POS')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('el PDF de un tipo del rol se devuelve', async () => {
    await expect(
      service.getDocumentForPrint('doc-1', userWith('document.create.CM')),
    ).resolves.toMatchObject({ id: 'doc-1' });
  });

  it('findOne interno no filtra por rol', async () => {
    await expect(service.findOne('doc-1')).resolves.toMatchObject({
      id: 'doc-1',
    });
  });
});
