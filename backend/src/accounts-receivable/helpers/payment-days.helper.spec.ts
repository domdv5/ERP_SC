import {
  calculatePaymentDays,
  findLastPaymentDate,
} from './payment-days.helper';

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('findLastPaymentDate', () => {
  it('devuelve la fecha más reciente entre todos los pagos', () => {
    expect(
      findLastPaymentDate([
        day('2026-09-20'),
        day('2026-10-05'),
        day('2026-09-01'),
      ]),
    ).toEqual(day('2026-10-05'));
  });

  it('sin pagos devuelve null', () => {
    expect(findLastPaymentDate([])).toBeNull();
  });
});

describe('calculatePaymentDays', () => {
  const today = day('2026-10-29');

  it('pagada: días entre la venta y el último pago, cerrada', () => {
    expect(
      calculatePaymentDays(day('2026-09-01'), day('2026-09-15'), 'paid', today),
    ).toEqual({ days: 14, isOpen: false });
  });

  it('parcial: días desde la venta hasta hoy, en curso', () => {
    expect(
      calculatePaymentDays(
        day('2026-09-01'),
        day('2026-09-20'),
        'partial',
        today,
      ),
    ).toEqual({ days: 58, isOpen: true });
  });

  it('pendiente sin pagos: días desde la venta hasta hoy, en curso', () => {
    expect(
      calculatePaymentDays(day('2026-10-10'), null, 'pending', today),
    ).toEqual({ days: 19, isOpen: true });
  });

  it('pagada sin pagos (saldada con saldo a favor al vender): 0 días', () => {
    expect(
      calculatePaymentDays(day('2026-10-10'), null, 'paid', today),
    ).toEqual({ days: 0, isOpen: false });
  });

  it('pagada el mismo día de la venta: 0 días', () => {
    expect(
      calculatePaymentDays(day('2026-10-10'), day('2026-10-10'), 'paid', today),
    ).toEqual({ days: 0, isOpen: false });
  });
});
