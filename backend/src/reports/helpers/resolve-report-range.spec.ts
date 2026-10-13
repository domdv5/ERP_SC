import { BadRequestException } from '@nestjs/common';
import { resolveReportRange } from './resolve-report-range';

// 2026-10-13 15:00 Bogotá
const now = new Date('2026-10-13T20:00:00.000Z');
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('resolveReportRange', () => {
  it('sin fechas devuelve los últimos 30 días terminando hoy', () => {
    expect(resolveReportRange(undefined, undefined, now)).toEqual({
      from: day('2026-09-14'),
      to: day('2026-10-13'),
    });
  });

  it('usa el día de Bogotá y no el UTC cuando ya cambió el día en UTC', () => {
    const lateNight = new Date('2026-10-14T02:00:00.000Z');
    expect(resolveReportRange(undefined, undefined, lateNight).to).toEqual(
      day('2026-10-13'),
    );
  });

  it('con solo from termina hoy', () => {
    expect(resolveReportRange('2026-10-01', undefined, now)).toEqual({
      from: day('2026-10-01'),
      to: day('2026-10-13'),
    });
  });

  it('con solo to empieza 29 días antes', () => {
    expect(resolveReportRange(undefined, '2026-10-30', now).from).toEqual(
      day('2026-10-01'),
    );
  });

  it('rechaza from posterior a to', () => {
    const call = () => resolveReportRange('2026-10-10', '2026-10-09', now);
    expect(call).toThrow(BadRequestException);
    expect(call).toThrow('from no puede ser posterior a to');
  });

  it('acepta from igual a to', () => {
    expect(resolveReportRange('2026-10-10', '2026-10-10', now)).toEqual({
      from: day('2026-10-10'),
      to: day('2026-10-10'),
    });
  });

  it('acepta exactamente 366 días y rechaza 367', () => {
    expect(() =>
      resolveReportRange('2025-10-13', '2026-10-13', now),
    ).not.toThrow();
    const call = () => resolveReportRange('2025-10-12', '2026-10-13', now);
    expect(call).toThrow(BadRequestException);
    expect(call).toThrow('366');
  });

  it('rechaza fechas inexistentes', () => {
    expect(() => resolveReportRange('2026-02-30', undefined, now)).toThrow(
      BadRequestException,
    );
  });
});
