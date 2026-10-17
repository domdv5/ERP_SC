import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDocumentDto } from '@/documents/dto/index';
import { CmEffectStrategy } from './cm-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

const MISSING_MESSAGE = 'La compra requiere indicar quién recibió la mercancía';
const INVALID_MESSAGE = 'La persona que recibió la mercancía no es válida';

describe('CmEffectStrategy: recibido por', () => {
  const prisma = {
    thirdParty: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  };
  const strategy = new CmEffectStrategy(prisma as unknown as PrismaService);
  const tx = {} as Prisma.TransactionClient;

  const makeDto = (overrides: Partial<CreateDocumentDto> = {}) =>
    ({
      thirdPartyId: 'sup-1',
      receiverId: 'rec-1',
      items: [],
      ...overrides,
    }) as unknown as CreateDocumentDto;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.product.findMany.mockResolvedValue([]);
    jest
      .spyOn(
        strategy as unknown as {
          assertValidSupplier: () => Promise<void>;
          assertItemsMatchSupplierBrands: () => Promise<void>;
        },
        'assertValidSupplier',
      )
      .mockResolvedValue();
    jest
      .spyOn(
        strategy as unknown as {
          assertItemsMatchSupplierBrands: () => Promise<void>;
        },
        'assertItemsMatchSupplierBrands',
      )
      .mockResolvedValue();
  });

  describe('validateCreate', () => {
    it('rechaza una compra sin receiverId', async () => {
      await expect(
        strategy.validateCreate(makeDto({ receiverId: undefined })),
      ).rejects.toThrow(new BadRequestException(MISSING_MESSAGE));
    });

    it('rechaza un tercero que no existe', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue(null);

      await expect(strategy.validateCreate(makeDto())).rejects.toThrow(
        new BadRequestException(INVALID_MESSAGE),
      );
    });

    it('rechaza un tercero sin el rol de recibe mercancía', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue({
        isReceiver: false,
        isActive: true,
      });

      await expect(strategy.validateCreate(makeDto())).rejects.toThrow(
        new BadRequestException(INVALID_MESSAGE),
      );
    });

    it('rechaza un receptor desactivado', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue({
        isReceiver: true,
        isActive: false,
      });

      await expect(strategy.validateCreate(makeDto())).rejects.toThrow(
        new BadRequestException(INVALID_MESSAGE),
      );
    });

    it('acepta un tercero con el rol', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue({
        isReceiver: true,
        isActive: true,
      });

      await expect(strategy.validateCreate(makeDto())).resolves.toBeUndefined();
    });
  });

  describe('confirm', () => {
    const makeDocument = (receiverId: string | null) =>
      ({
        id: 'doc-1',
        warehouseId: 'wh-1',
        receiverId,
        officialPurchase: false,
        thirdParty: { supplier: { id: 'sup-1' } },
        documentItems: [],
      }) as unknown as DocumentWithItems;

    it('rechaza un borrador de compra sin receptor', async () => {
      await expect(
        strategy.confirm(tx, makeDocument(null), 'u1'),
      ).rejects.toThrow(new BadRequestException(MISSING_MESSAGE));
    });

    it('rechaza un receptor sin el rol', async () => {
      prisma.thirdParty.findUnique.mockResolvedValue({
        isReceiver: false,
        isActive: true,
      });

      await expect(
        strategy.confirm(tx, makeDocument('rec-1'), 'u1'),
      ).rejects.toThrow(new BadRequestException(INVALID_MESSAGE));
    });
  });
});
