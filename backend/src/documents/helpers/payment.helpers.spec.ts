import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentMethod } from '@/common/enums';
import { assertPaymentsMatchTotal } from './payment.helpers';

const pay = (method: PaymentMethod, amount: number | string) => ({
  method,
  amount: new Prisma.Decimal(amount),
});

const errorOf = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    return error as BadRequestException;
  }
  throw new Error('no lanzó error');
};

describe('assertPaymentsMatchTotal', () => {
  it('acepta una sola forma de pago por el total', () => {
    expect(() =>
      assertPaymentsMatchTotal(
        [pay(PaymentMethod.efectivo_almacen, 50000)],
        50000,
      ),
    ).not.toThrow();
  });

  it('acepta varias formas de pago que suman el total exacto con decimales', () => {
    expect(() =>
      assertPaymentsMatchTotal(
        [
          pay(PaymentMethod.efectivo_almacen, '30000.10'),
          pay(PaymentMethod.consignacion_almacen, '20000.40'),
        ],
        new Prisma.Decimal('50000.50'),
      ),
    ).not.toThrow();
  });

  it('acepta cero formas de pago cuando no hay nada por cobrar', () => {
    expect(() => assertPaymentsMatchTotal([], 0)).not.toThrow();
  });

  it('rechaza sin formas de pago cuando hay algo por cobrar', () => {
    const error = errorOf(() => assertPaymentsMatchTotal([], 50000));
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('La venta requiere al menos una forma de pago');
  });

  it('rechaza un monto en cero o negativo', () => {
    const error = errorOf(() =>
      assertPaymentsMatchTotal(
        [
          pay(PaymentMethod.efectivo_almacen, 50000),
          pay(PaymentMethod.consignacion_almacen, 0),
        ],
        50000,
      ),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(
      'Cada forma de pago debe tener un monto mayor a 0',
    );
  });

  it('rechaza una forma de pago repetida', () => {
    const error = errorOf(() =>
      assertPaymentsMatchTotal(
        [
          pay(PaymentMethod.efectivo_almacen, 20000),
          pay(PaymentMethod.efectivo_almacen, 30000),
        ],
        50000,
      ),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('No se puede repetir una forma de pago');
  });

  it('rechaza si faltan pesos y dice cuánto falta', () => {
    const error = errorOf(() =>
      assertPaymentsMatchTotal(
        [
          pay(PaymentMethod.efectivo_almacen, 30000),
          pay(PaymentMethod.consignacion_almacen, 15000),
        ],
        50000,
      ),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message.replace(/\s/g, ' ')).toBe(
      'Las formas de pago suman $ 45.000 y el total a cobrar es $ 50.000: faltan $ 5.000',
    );
  });

  it('rechaza si sobran pesos y dice cuánto sobra', () => {
    const error = errorOf(() =>
      assertPaymentsMatchTotal(
        [pay(PaymentMethod.efectivo_almacen, 60000)],
        50000,
      ),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message.replace(/\s/g, ' ')).toBe(
      'Las formas de pago suman $ 60.000 y el total a cobrar es $ 50.000: sobran $ 10.000',
    );
  });

  it('rechaza formas de pago cuando no hay nada por cobrar', () => {
    const error = errorOf(() =>
      assertPaymentsMatchTotal([pay(PaymentMethod.efectivo_almacen, 1000)], 0),
    );
    expect(error.message.replace(/\s/g, ' ')).toBe(
      'Las formas de pago suman $ 1.000 y el total a cobrar es $ 0: sobran $ 1.000',
    );
  });
});
