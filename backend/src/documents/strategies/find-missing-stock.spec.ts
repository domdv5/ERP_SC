import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { BaseEffectStrategy } from './base-effect.strategy';
import { CotEffectStrategy } from './cot-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { PosEffectStrategy } from './pos-effect.strategy';
import { PvEffectStrategy } from './pv-effect.strategy';
import { RemEffectStrategy } from './rem-effect.strategy';

const tx = {} as Prisma.TransactionClient;
const missingItem = {
  productId: 'p1',
  code: 'PRD-1',
  available: 2,
  requested: 5,
};

const makeDocument = (overrides: Partial<DocumentWithItems> = {}) =>
  ({
    id: 'doc-1',
    warehouseId: 'wh-1',
    sourceDocumentId: 'pv-origen',
    documentItems: [
      { productId: 'p1', quantity: 5, product: { code: 'PRD-1' } },
    ],
    ...overrides,
  }) as unknown as DocumentWithItems;

describe('findMissingStock', () => {
  let batchSpy: jest.SpyInstance;

  beforeEach(() => {
    batchSpy = jest
      .spyOn(
        BaseEffectStrategy.prototype as unknown as {
          calculateMissingStock: () => Promise<unknown>;
        },
        'calculateMissingStock',
      )
      .mockResolvedValue([missingItem]);
  });

  afterEach(() => jest.restoreAllMocks());

  const prisma = {} as PrismaService;

  it.each([
    ['POS', new PosEffectStrategy(prisma)],
    ['COT', new CotEffectStrategy(prisma)],
  ])('%s excluye la reserva de la preventa origen', async (_, strategy) => {
    const document = makeDocument();

    await expect(strategy.findMissingStock(tx, document)).resolves.toEqual([
      missingItem,
    ]);
    expect(batchSpy).toHaveBeenCalledWith(tx, 'wh-1', document.documentItems, {
      excludeDocumentId: 'pv-origen',
    });
  });

  it('POS sin documento origen no excluye ninguna reserva', async () => {
    const document = makeDocument({ sourceDocumentId: null });

    await new PosEffectStrategy(prisma).findMissingStock(tx, document);

    expect(batchSpy).toHaveBeenCalledWith(tx, 'wh-1', document.documentItems, {
      excludeDocumentId: undefined,
    });
  });

  it.each([
    ['PV', new PvEffectStrategy(prisma)],
    ['REM', new RemEffectStrategy(prisma)],
  ])('%s excluye su propia reserva', async (_, strategy) => {
    const document = makeDocument();

    await strategy.findMissingStock(tx, document);

    expect(batchSpy).toHaveBeenCalledWith(tx, 'wh-1', document.documentItems, {
      excludeDocumentId: 'doc-1',
    });
  });
});
