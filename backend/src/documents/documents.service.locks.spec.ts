import { ConflictException } from '@nestjs/common';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { DocumentsService } from './documents.service';
import { DocumentsQueryService } from './documents-query.service';
import { DocumentConversionService } from './document-conversion.service';
import { DocumentEffectsRegistry } from './strategies/document-effects.registry';

const user = {
  sub: 'u1',
  permissions: ['document.release.PV', 'document.convert.PV'],
} as unknown as JwtPayload;

const makeSource = () => ({
  id: 'pv-1',
  type: DocumentType.PV,
  status: DocumentStatus.confirmed,
  thirdPartyId: 'c1',
  sellerId: 's1',
  customerBranchId: 'br-1',
  documentItems: [
    {
      productId: 'p1',
      quantity: 2,
      releasedQuantity: 0,
      convertedQuantity: 0,
      unitPrice: 10,
      product: { code: 'PRD-1' },
    },
  ],
  derivedDocuments: [],
});

describe('DocumentsService: lock del documento antes de liberar o convertir', () => {
  const tx = {
    $queryRaw: jest.fn(),
    document: { count: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    document: { findUnique: jest.fn() },
    warehouse: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const releaseItems = jest.fn();
  const registry = {
    get: jest.fn(() => ({ validateCreate: jest.fn() })),
    getReservation: jest.fn(() => ({ releaseItems })),
  };
  const sequence = { next: jest.fn().mockResolvedValue('POS-1') };
  const documentsQuery = new DocumentsQueryService(
    prisma as unknown as PrismaService,
  );
  const service = new DocumentsService(
    prisma as unknown as PrismaService,
    registry as unknown as DocumentEffectsRegistry,
    sequence as unknown as SequenceService,
    documentsQuery,
  );
  const conversionService = new DocumentConversionService(
    prisma as unknown as PrismaService,
    registry as unknown as DocumentEffectsRegistry,
    sequence as unknown as SequenceService,
  );
  const releaseDto = { items: [{ documentItemId: 'i1', quantity: 1 }] };
  const convertDto = { targetType: DocumentType.POS };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.document.findUnique.mockResolvedValue(makeSource());
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'store-1' });
    tx.document.count.mockResolvedValue(0);
    tx.document.create.mockResolvedValue({
      id: 'pos-1',
      type: DocumentType.POS,
      derivedDocuments: [],
    });
    jest.spyOn(documentsQuery, 'findOne').mockResolvedValue({} as never);
  });

  describe('releaseItems', () => {
    it('rechaza con 409 si una anulación concurrente dejó el documento anulado', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: DocumentStatus.voided }]);

      await expect(
        service.releaseItems('pv-1', releaseDto, user),
      ).rejects.toThrow(
        new ConflictException(
          'Solo se pueden liberar reservas de documentos confirmados',
        ),
      );
      expect(releaseItems).not.toHaveBeenCalled();
    });

    it('libera si el documento sigue confirmado tras el lock', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: DocumentStatus.confirmed }]);

      await service.releaseItems('pv-1', releaseDto, user);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(releaseItems).toHaveBeenCalledTimes(1);
    });
  });

  describe('convert', () => {
    it('rechaza con 409 si una conversión concurrente ya creó una venta derivada activa', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: DocumentStatus.confirmed }]);
      tx.document.count.mockResolvedValue(1);

      await expect(
        conversionService.convert('pv-1', convertDto as never, user),
      ).rejects.toThrow(
        new ConflictException(
          'Este documento ya tiene una venta derivada activa. Anúlela antes de convertir de nuevo.',
        ),
      );
      expect(tx.document.create).not.toHaveBeenCalled();
      expect(sequence.next).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el origen dejó de estar confirmado tras el lock', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: DocumentStatus.voided }]);

      await expect(
        conversionService.convert('pv-1', convertDto as never, user),
      ).rejects.toThrow(ConflictException);
      expect(tx.document.create).not.toHaveBeenCalled();
    });

    it('crea la venta derivada si no hay otra activa', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: DocumentStatus.confirmed }]);

      await conversionService.convert('pv-1', convertDto as never, user);

      expect(tx.document.count).toHaveBeenCalledWith({
        where: {
          sourceDocumentId: 'pv-1',
          status: { not: DocumentStatus.voided },
        },
      });
      expect(tx.document.create).toHaveBeenCalledTimes(1);
    });

    it('copia la sucursal del origen al documento derivado', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: DocumentStatus.confirmed }]);

      await conversionService.convert('pv-1', convertDto as never, user);

      expect(tx.document.create.mock.calls[0][0].data.customerBranchId).toBe(
        'br-1',
      );
    });

    it('el borrador derivado nace sin formas de pago', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: DocumentStatus.confirmed }]);

      await conversionService.convert('pv-1', convertDto as never, user);

      const { data } = tx.document.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('payments');
      expect(data).not.toHaveProperty('paymentMethod');
    });
  });
});
