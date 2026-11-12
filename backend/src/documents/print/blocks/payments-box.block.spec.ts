import { PaymentMethod } from '@/common/enums';
import { buildPaymentsBox } from './payments-box.block';

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
  return found.map((text) => text.replace(/\s/g, ' '));
};

describe('buildPaymentsBox', () => {
  it('sin formas de pago no imprime nada', () => {
    expect(texts(buildPaymentsBox([]))).toEqual(['']);
  });

  it('sin crédito lista las formas de pago y no muestra el resumen', () => {
    const all = texts(
      buildPaymentsBox([
        { method: PaymentMethod.efectivo_almacen, amount: 60000 },
        { method: PaymentMethod.consignacion_almacen, amount: 40000 },
      ]),
    );

    expect(all).toEqual(
      expect.arrayContaining(['Efectivo almacén', 'Consignación almacén']),
    );
    expect(all).not.toContain('A crédito');
    expect(all).not.toContain('Pagado');
  });

  it('con crédito: Pagado suma solo lo que no es crédito', () => {
    const all = texts(
      buildPaymentsBox([
        { method: PaymentMethod.efectivo_almacen, amount: 200000 },
        { method: PaymentMethod.consignacion_almacen, amount: 100000 },
        { method: PaymentMethod.credito, amount: 200000 },
      ]),
    );

    expect(all).toEqual(
      expect.arrayContaining(['Crédito', 'Pagado', 'A crédito']),
    );
    const money = all.filter((text) => text.includes('$'));
    expect(money.at(-2)).toMatch(/300\.000/);
    expect(money.at(-1)).toMatch(/200\.000/);
  });
});
