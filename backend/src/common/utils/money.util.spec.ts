import { Prisma } from '@prisma/client';
import { toCents } from './money.util';

describe('toCents', () => {
  it('convierte pesos a centavos enteros: 1234.56 → 123456', () => {
    expect(toCents(1234.56)).toBe(123456);
  });

  it('un monto sin decimales: 50000 → 5000000', () => {
    expect(toCents(50000)).toBe(5000000);
  });

  it('cero y negativos: 0 → 0 y -12.34 → -1234', () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(-12.34)).toBe(-1234);
  });

  it('absorbe el error de coma flotante: 0.1 + 0.2 → 30 centavos', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('redondea la fracción de centavo: 0.105 → 11 y 0.104 → 10', () => {
    expect(toCents(0.105)).toBe(11);
    expect(toCents(0.104)).toBe(10);
  });

  it('acepta Prisma.Decimal: 19.99 → 1999', () => {
    expect(toCents(new Prisma.Decimal('19.99'))).toBe(1999);
  });

  it('un Decimal con más de 2 decimales se redondea: 10.005 → 1001', () => {
    expect(toCents(new Prisma.Decimal('10.005'))).toBe(1001);
  });

  it('montos grandes siguen siendo enteros exactos: 9.999.999.999,99 → 999999999999', () => {
    expect(toCents(9999999999.99)).toBe(999999999999);
    expect(toCents(new Prisma.Decimal('9999999999.99'))).toBe(999999999999);
  });
});
