import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PosEffectStrategy } from './pos-effect.strategy';

type CalculateMissingStock = (
  tx: Prisma.TransactionClient,
  warehouseId: string,
  items: { productId: string; quantity: number; product: { code: string } }[],
) => Promise<unknown>;

describe('calculateMissingStock', () => {
  const items = [{ productId: 'p1', quantity: 1, product: { code: 'PRD-1' } }];

  const makeTx = () => {
    let releaseLock!: (rows: unknown) => void;
    const tx = {
      $queryRaw: jest.fn(
        () => new Promise((resolve) => (releaseLock = resolve)),
      ),
      documentItem: {
        groupBy: jest.fn().mockResolvedValue([
          {
            productId: 'p1',
            _sum: { quantity: 1, releasedQuantity: 0, convertedQuantity: 0 },
          },
        ]),
      },
    };
    return { tx, releaseLock: (rows: unknown) => releaseLock(rows) };
  };

  const calculate = (tx: unknown, lines = items) =>
    (
      new PosEffectStrategy({} as PrismaService) as unknown as {
        calculateMissingStock: CalculateMissingStock;
      }
    ).calculateMissingStock(tx as Prisma.TransactionClient, 'wh-1', lines);

  it('lee las reservas solo después de obtener el lock de inventario', async () => {
    const { tx, releaseLock } = makeTx();

    const pending = calculate(tx);
    await new Promise((resolve) => setImmediate(resolve));

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.documentItem.groupBy).not.toHaveBeenCalled();

    releaseLock([{ product_id: 'p1', quantity: 1 }]);

    await expect(pending).resolves.toEqual([
      { productId: 'p1', code: 'PRD-1', available: 0, requested: 1 },
    ]);
    expect(tx.documentItem.groupBy).toHaveBeenCalledTimes(1);
  });

  it('con stock suficiente descontando reservas no reporta faltantes', async () => {
    const { tx, releaseLock } = makeTx();

    const pending = calculate(tx);
    releaseLock([{ product_id: 'p1', quantity: 2 }]);

    await expect(pending).resolves.toEqual([]);
  });

  it('suma las filas repetidas del mismo producto y reporta un solo faltante', async () => {
    const { tx, releaseLock } = makeTx();

    const pending = calculate(tx, [
      { productId: 'p1', quantity: 3, product: { code: 'PRD-1' } },
      { productId: 'p1', quantity: 3, product: { code: 'PRD-1' } },
    ]);
    releaseLock([{ product_id: 'p1', quantity: 6 }]);

    await expect(pending).resolves.toEqual([
      { productId: 'p1', code: 'PRD-1', available: 5, requested: 6 },
    ]);
  });

  it('con filas repetidas que caben en el disponible no reporta faltantes', async () => {
    const { tx, releaseLock } = makeTx();

    const pending = calculate(tx, [
      { productId: 'p1', quantity: 2, product: { code: 'PRD-1' } },
      { productId: 'p2', quantity: 1, product: { code: 'PRD-2' } },
      { productId: 'p1', quantity: 3, product: { code: 'PRD-1' } },
    ]);
    releaseLock([
      { product_id: 'p1', quantity: 6 },
      { product_id: 'p2', quantity: 1 },
    ]);

    await expect(pending).resolves.toEqual([]);
  });
});
