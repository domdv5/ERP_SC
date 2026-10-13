import { BadRequestException } from '@nestjs/common';
import { assertValidCalendarDate } from '@/common/utils/date-range.util';
import type { DateRange } from '../reports.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

function toUtcMidnight(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayInBogota(now: Date) {
  return toUtcMidnight(
    now.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' }),
  );
}

/** Rango inclusivo a medianoche UTC; sin fechas son los últimos 30 días terminando hoy (Bogotá). */
export function resolveReportRange(
  from?: string,
  to?: string,
  now: Date = new Date(),
): DateRange {
  if (from) assertValidCalendarDate('from', from);
  if (to) assertValidCalendarDate('to', to);

  const end = to ? toUtcMidnight(to) : todayInBogota(now);
  const start = from
    ? toUtcMidnight(from)
    : new Date(end.getTime() - (DEFAULT_DAYS - 1) * DAY_MS);

  if (start > end) {
    throw new BadRequestException('from no puede ser posterior a to');
  }
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (days > MAX_DAYS) {
    throw new BadRequestException(`El rango no puede superar ${MAX_DAYS} días`);
  }
  return { from: start, to: end };
}
