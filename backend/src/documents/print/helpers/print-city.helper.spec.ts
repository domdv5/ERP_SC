import { formatPrintCity } from './print-city.helper';

const medellin = { name: 'MEDELLÍN', department: { name: 'ANTIOQUIA' } };
const cali = {
  name: 'SANTIAGO DE CALI',
  department: { name: 'VALLE DEL CAUCA' },
};

describe('formatPrintCity', () => {
  it('usa la ciudad de la sucursal cuando la tiene', () => {
    expect(formatPrintCity({ city: cali }, { city: medellin })).toBe(
      'SANTIAGO DE CALI, VALLE DEL CAUCA',
    );
  });

  it('usa la ciudad del tercero si la sucursal no tiene', () => {
    expect(formatPrintCity({ city: null }, { city: medellin })).toBe(
      'MEDELLÍN, ANTIOQUIA',
    );
    expect(formatPrintCity(undefined, { city: medellin })).toBe(
      'MEDELLÍN, ANTIOQUIA',
    );
  });

  it('devuelve null si ninguno tiene ciudad', () => {
    expect(formatPrintCity({ city: null }, { city: null })).toBeNull();
    expect(formatPrintCity(undefined, null)).toBeNull();
  });
});
