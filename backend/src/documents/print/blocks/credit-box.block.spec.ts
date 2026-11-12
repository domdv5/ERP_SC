import { PaymentMethod } from '@/common/enums';
import { buildCreditBox } from './credit-box.block';

const texts = (content: unknown): string[] => {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if (typeof record.text === 'string') found.push(record.text);
      Object.values(record).forEach(walk);
    }
  };
  walk(content);
  return found
    .map((text) => text.replace(/\s/g, ' '))
    .filter((text) => text !== '');
};

describe('buildCreditBox', () => {
  it('venta toda de contado: no imprime nada', () => {
    expect(
      texts(
        buildCreditBox([
          { method: PaymentMethod.efectivo_almacen, amount: 60000 },
          { method: PaymentMethod.consignacion_almacen, amount: 40000 },
        ]),
      ),
    ).toEqual([]);
  });

  it('sin formas de pago: no imprime nada', () => {
    expect(texts(buildCreditBox([]))).toEqual([]);
  });

  it('con crédito: imprime solo "A crédito" y su monto, sin las formas de pago', () => {
    const all = texts(
      buildCreditBox([
        { method: PaymentMethod.efectivo_almacen, amount: 200000 },
        { method: PaymentMethod.consignacion_almacen, amount: 100000 },
        { method: PaymentMethod.credito, amount: 200000 },
      ]),
    );

    expect(all).toHaveLength(2);
    expect(all[0]).toBe('A crédito');
    expect(all[1]).toMatch(/^\$ ?200\.000$/);
  });
});
