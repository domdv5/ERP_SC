import { BadRequestException } from '@nestjs/common';
import { CustomerCreditUsableIn, DvvRefundMethod } from '@prisma/client';
import {
  resolveCreditUsableIn,
  resolveStoredCreditUsableIn,
} from './credit-usable-in.helpers';

describe('resolveCreditUsableIn', () => {
  it('saldo_a_favor keeps the chosen destination', () => {
    expect(
      resolveCreditUsableIn(
        DvvRefundMethod.saldo_a_favor,
        CustomerCreditUsableIn.administracion,
      ),
    ).toBe(CustomerCreditUsableIn.administracion);
    expect(
      resolveCreditUsableIn(
        DvvRefundMethod.saldo_a_favor,
        CustomerCreditUsableIn.facturacion,
      ),
    ).toBe(CustomerCreditUsableIn.facturacion);
  });

  it('saldo_a_favor without destination is rejected', () => {
    expect(() =>
      resolveCreditUsableIn(DvvRefundMethod.saldo_a_favor, null),
    ).toThrow(
      new BadRequestException(
        'Seleccione dónde se usará el saldo a favor: en facturación o en administración',
      ),
    );
  });

  it('cambio_producto is always facturacion, whatever was sent', () => {
    expect(
      resolveCreditUsableIn(
        DvvRefundMethod.cambio_producto,
        CustomerCreditUsableIn.administracion,
      ),
    ).toBe(CustomerCreditUsableIn.facturacion);
    expect(resolveCreditUsableIn(DvvRefundMethod.cambio_producto, null)).toBe(
      CustomerCreditUsableIn.facturacion,
    );
  });

  it('devolucion_dinero creates no credit', () => {
    expect(
      resolveCreditUsableIn(
        DvvRefundMethod.devolucion_dinero,
        CustomerCreditUsableIn.administracion,
      ),
    ).toBeNull();
  });
});

describe('resolveStoredCreditUsableIn', () => {
  it('saldo_a_favor guarda el destino elegido', () => {
    expect(
      resolveStoredCreditUsableIn(
        DvvRefundMethod.saldo_a_favor,
        CustomerCreditUsableIn.administracion,
      ),
    ).toBe(CustomerCreditUsableIn.administracion);
  });

  it('cambio_producto y devolucion_dinero guardan null', () => {
    expect(
      resolveStoredCreditUsableIn(
        DvvRefundMethod.cambio_producto,
        CustomerCreditUsableIn.administracion,
      ),
    ).toBeNull();
    expect(
      resolveStoredCreditUsableIn(
        DvvRefundMethod.devolucion_dinero,
        CustomerCreditUsableIn.facturacion,
      ),
    ).toBeNull();
  });
});
