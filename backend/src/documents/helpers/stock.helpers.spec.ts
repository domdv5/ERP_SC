import { Prisma } from '@prisma/client';
import { computeNewAvgCost, computeReversedAvgCost } from './stock.helpers';

function fakeTx(globalStock: number | null) {
  const aggregate = jest.fn(async () => ({ _sum: { quantity: globalStock } }));
  const tx = {
    inventory: { aggregate },
  } as unknown as Prisma.TransactionClient;
  return { tx, aggregate };
}

describe('computeNewAvgCost', () => {
  it('promedia ponderado sobre el stock previo: 10 a $100 + 5 a $160 = $120', async () => {
    const { tx } = fakeTx(10);

    const result = await computeNewAvgCost(tx, 'prod-1', 100, 5, 160);

    expect(result).toBeCloseTo(120, 10);
  });

  it('consulta el stock global del producto sumando todas las bodegas', async () => {
    const { tx, aggregate } = fakeTx(10);

    await computeNewAvgCost(tx, 'prod-1', 100, 5, 160);

    expect(aggregate).toHaveBeenCalledWith({
      _sum: { quantity: true },
      where: { productId: 'prod-1' },
    });
  });

  it('con stock 0 el costo promedio queda igual al costo de la entrada', async () => {
    const { tx } = fakeTx(0);

    const result = await computeNewAvgCost(tx, 'prod-1', 999, 5, 160);

    expect(result).toBe(160);
  });

  it('sin filas de inventario (suma null) se trata como stock 0', async () => {
    const { tx } = fakeTx(null);

    const result = await computeNewAvgCost(tx, 'prod-1', 999, 4, 50);

    expect(result).toBe(50);
  });

  it('con stock negativo que deja el denominador en 0 o menos devuelve el costo de la entrada', async () => {
    const { tx } = fakeTx(-5);

    const result = await computeNewAvgCost(tx, 'prod-1', 100, 5, 160);

    expect(result).toBe(160);
  });

  it('con stock negativo y denominador positivo sí pondera: -2 a $100 + 5 a $160 = $200', async () => {
    const { tx } = fakeTx(-2);

    // (-2 × 100 + 5 × 160) / 3 = 600 / 3
    const result = await computeNewAvgCost(tx, 'prod-1', 100, 5, 160);

    expect(result).toBeCloseTo(200, 10);
  });
});

describe('computeReversedAvgCost', () => {
  it('deshace la entrada: con 15 a $120 tras comprar 5 a $160 vuelve a $100', async () => {
    const { tx } = fakeTx(15);

    const result = await computeReversedAvgCost(tx, 'prod-1', 120, 5, 160);

    expect(result).toBeCloseTo(100, 10);
  });

  it('anular una compra justo después de hacerla devuelve el promedio original (ida y vuelta)', async () => {
    const stockAntes = 7;
    const avgAntes = 83.5;
    const cantidad = 13;
    const costo = 140;

    const antes = fakeTx(stockAntes);
    const avgNuevo = await computeNewAvgCost(
      antes.tx,
      'prod-1',
      avgAntes,
      cantidad,
      costo,
    );

    const despues = fakeTx(stockAntes + cantidad);
    const avgRevertido = await computeReversedAvgCost(
      despues.tx,
      'prod-1',
      avgNuevo,
      cantidad,
      costo,
    );

    expect(avgRevertido).toBeCloseTo(avgAntes, 8);
  });

  it('si la compra era todo el stock (denominador 0) conserva el promedio actual', async () => {
    const { tx } = fakeTx(5);

    const result = await computeReversedAvgCost(tx, 'prod-1', 160, 5, 160);

    expect(result).toBe(160);
  });

  it('con stock menor a la cantidad a revertir (denominador negativo) conserva el promedio actual', async () => {
    const { tx } = fakeTx(3);

    const result = await computeReversedAvgCost(tx, 'prod-1', 120, 5, 160);

    expect(result).toBe(120);
  });

  it('sin filas de inventario (suma null) conserva el promedio actual', async () => {
    const { tx } = fakeTx(null);

    const result = await computeReversedAvgCost(tx, 'prod-1', 120, 5, 160);

    expect(result).toBe(120);
  });
});
