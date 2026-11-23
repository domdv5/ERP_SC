import { BadRequestException } from '@nestjs/common';
import {
  assertValidCalendarDate,
  buildDateColumnRange,
} from './date-range.util';

describe('assertValidCalendarDate', () => {
  it('acepta una fecha real: 2026-03-15', () => {
    expect(() =>
      assertValidCalendarDate('dateFrom', '2026-03-15'),
    ).not.toThrow();
  });

  it('rechaza el 30 de febrero aunque Date lo corra en silencio al 2 de marzo', () => {
    expect(() => assertValidCalendarDate('dateFrom', '2026-02-30')).toThrow(
      new BadRequestException('dateFrom no es una fecha válida'),
    );
  });

  it('rechaza el mes 13', () => {
    expect(() => assertValidCalendarDate('dateTo', '2026-13-01')).toThrow(
      new BadRequestException('dateTo no es una fecha válida'),
    );
  });

  it('rechaza el día 31 en un mes de 30 días: 2026-04-31', () => {
    expect(() => assertValidCalendarDate('dateFrom', '2026-04-31')).toThrow(
      BadRequestException,
    );
  });

  it('acepta el 29 de febrero en año bisiesto (2028)', () => {
    expect(() =>
      assertValidCalendarDate('dateFrom', '2028-02-29'),
    ).not.toThrow();
  });

  it('rechaza el 29 de febrero en año no bisiesto (2026)', () => {
    expect(() => assertValidCalendarDate('dateFrom', '2026-02-29')).toThrow(
      BadRequestException,
    );
  });
});

describe('buildDateColumnRange', () => {
  it('sin fechas devuelve un filtro vacío', () => {
    expect(buildDateColumnRange()).toEqual({});
  });

  it('solo dateFrom: únicamente gte a medianoche UTC', () => {
    expect(buildDateColumnRange('2026-03-01')).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
    });
  });

  it('solo dateTo: únicamente lte a medianoche UTC', () => {
    expect(buildDateColumnRange(undefined, '2026-03-31')).toEqual({
      lte: new Date('2026-03-31T00:00:00.000Z'),
    });
  });

  it('ambas fechas: gte y lte inclusivos', () => {
    expect(buildDateColumnRange('2026-03-01', '2026-03-31')).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lte: new Date('2026-03-31T00:00:00.000Z'),
    });
  });

  it('dateFrom igual a dateTo es un rango válido de un solo día', () => {
    expect(buildDateColumnRange('2026-03-10', '2026-03-10')).toEqual({
      gte: new Date('2026-03-10T00:00:00.000Z'),
      lte: new Date('2026-03-10T00:00:00.000Z'),
    });
  });

  it('dateFrom posterior a dateTo lanza BadRequestException', () => {
    expect(() => buildDateColumnRange('2026-04-01', '2026-03-31')).toThrow(
      new BadRequestException('dateFrom no puede ser posterior a dateTo'),
    );
  });

  it('valida la fecha calendario antes del rango: 2026-02-30 se rechaza', () => {
    expect(() => buildDateColumnRange('2026-02-30', '2026-03-31')).toThrow(
      new BadRequestException('dateFrom no es una fecha válida'),
    );
  });
});
