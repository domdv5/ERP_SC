import {
  matchItemsByProduct,
  matchConvertedItemsByProduct,
} from './conversion.helpers';

const row = (
  id: string,
  productId: string,
  quantity: number,
  convertedQuantity = 0,
  releasedQuantity = 0,
) => ({ id, productId, quantity, releasedQuantity, convertedQuantity });

describe('matchItemsByProduct', () => {
  it('una fila por producto: le asigna todo lo que trae la venta, como antes', () => {
    expect(
      matchItemsByProduct(
        [row('r1', 'A', 20), row('r2', 'B', 5)],
        [
          { productId: 'A', quantity: 20 },
          { productId: 'B', quantity: 5 },
        ],
      ),
    ).toEqual([
      { documentItemId: 'r1', quantity: 20 },
      { documentItemId: 'r2', quantity: 5 },
    ]);
  });

  it('producto repetido en la REM: reparte la suma entre sus filas sin pasar lo pendiente de cada una', () => {
    expect(
      matchItemsByProduct(
        [row('r1', 'D', 20), row('r2', 'A', 20), row('r3', 'D', 20)],
        [
          { productId: 'D', quantity: 20 },
          { productId: 'A', quantity: 20 },
          { productId: 'D', quantity: 20 },
        ],
      ),
    ).toEqual([
      { documentItemId: 'r1', quantity: 20 },
      { documentItemId: 'r2', quantity: 20 },
      { documentItemId: 'r3', quantity: 20 },
    ]);
  });

  it('salta las filas ya liberadas o convertidas y llena las que tienen pendiente', () => {
    expect(
      matchItemsByProduct(
        [row('r1', 'D', 20, 0, 20), row('r2', 'D', 20, 5)],
        [{ productId: 'D', quantity: 15 }],
      ),
    ).toEqual([{ documentItemId: 'r2', quantity: 15 }]);
  });

  it('si sobra cantidad, el sobrante va a la última fila para que lo frene la base', () => {
    expect(
      matchItemsByProduct(
        [row('r1', 'D', 20), row('r2', 'D', 20)],
        [{ productId: 'D', quantity: 50 }],
      ),
    ).toEqual([
      { documentItemId: 'r1', quantity: 20 },
      { documentItemId: 'r2', quantity: 30 },
    ]);
  });
});

describe('matchConvertedItemsByProduct', () => {
  it('al anular devuelve lo convertido a cada fila repetida, no todo a la primera', () => {
    expect(
      matchConvertedItemsByProduct(
        [
          row('r1', 'D', 20, 20),
          row('r2', 'A', 20, 20),
          row('r3', 'D', 20, 20),
        ],
        [
          { productId: 'D', quantity: 20 },
          { productId: 'A', quantity: 20 },
          { productId: 'D', quantity: 20 },
        ],
      ),
    ).toEqual([
      { documentItemId: 'r1', quantity: 20 },
      { documentItemId: 'r2', quantity: 20 },
      { documentItemId: 'r3', quantity: 20 },
    ]);
  });

  it('solo descuenta de las filas que tienen convertido', () => {
    expect(
      matchConvertedItemsByProduct(
        [row('r1', 'D', 20, 0), row('r2', 'D', 20, 10)],
        [{ productId: 'D', quantity: 10 }],
      ),
    ).toEqual([{ documentItemId: 'r2', quantity: 10 }]);
  });
});
