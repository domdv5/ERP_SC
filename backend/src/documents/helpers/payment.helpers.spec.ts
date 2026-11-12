import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentMethod } from '@/common/enums';
import {
  assertCreditIsPartial,
  assertNoCreditPayment,
  assertPaymentsMatchTotal,
  getCreditPaymentAmount,
} from './payment.helpers';

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

describe('getCreditPaymentAmount', () => {
  it('devuelve el monto de la línea crédito', () => {
    const amount = getCreditPaymentAmount([
      pay(PaymentMethod.efectivo_almacen, 300000),
      pay(PaymentMethod.credito, '200000.50'),
    ]);
    expect(amount.toString()).toBe('200000.5');
  });

  it('devuelve 0 cuando no hay línea crédito', () => {
    const amount = getCreditPaymentAmount([
      pay(PaymentMethod.efectivo_almacen, 500000),
    ]);
    expect(amount.toString()).toBe('0');
  });
});

describe('assertCreditIsPartial', () => {
  it('acepta crédito menor al total a cobrar', () => {
    expect(() =>
      assertCreditIsPartial(new Prisma.Decimal(200000), 500000),
    ).not.toThrow();
  });

  it('acepta cuando no hay crédito', () => {
    expect(() =>
      assertCreditIsPartial(new Prisma.Decimal(0), 500000),
    ).not.toThrow();
  });

  it('rechaza crédito por el 100% y manda a la venta a crédito', () => {
    const error = errorOf(() =>
      assertCreditIsPartial(new Prisma.Decimal(500000), 500000),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(
      'El crédito no puede cubrir toda la venta. Si todo queda a crédito, haz una venta a crédito (COT).',
    );
  });
});

describe('assertNoCreditPayment', () => {
  it('acepta formas de pago sin crédito', () => {
    expect(() =>
      assertNoCreditPayment([pay(PaymentMethod.efectivo_almacen, 100)]),
    ).not.toThrow();
  });

  it('rechaza una línea crédito', () => {
    const error = errorOf(() =>
      assertNoCreditPayment([
        pay(PaymentMethod.efectivo_almacen, 100),
        pay(PaymentMethod.credito, 50),
      ]),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('Esta venta no admite pago a crédito');
  });
});
