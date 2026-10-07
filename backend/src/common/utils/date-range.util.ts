import { BadRequestException } from '@nestjs/common';

// El regex del DTO solo valida la forma; un overflow de día (02-30) no da Invalid Date, por eso se compara el round-trip.
export function assertValidCalendarDate(label: string, value: string) {
  const date = new Date(`${value}T00:00:00.000-05:00`);
  const roundTrip = date.toLocaleDateString('sv-SE', {
    timeZone: 'America/Bogota',
  });
  if (Number.isNaN(date.getTime()) || roundTrip !== value) {
    throw new BadRequestException(`${label} no es una fecha válida`);
  }
}

/** Valida el rango YYYY-MM-DD y devuelve el filtro sobre una columna `@db.Date` (medianoche UTC), con dateTo inclusivo. */
export function buildDateColumnRange(dateFrom?: string, dateTo?: string) {
  if (dateFrom) assertValidCalendarDate('dateFrom', dateFrom);
  if (dateTo) assertValidCalendarDate('dateTo', dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new BadRequestException('dateFrom no puede ser posterior a dateTo');
  }

  return {
    ...(dateFrom && { gte: new Date(`${dateFrom}T00:00:00.000Z`) }),
    ...(dateTo && { lte: new Date(`${dateTo}T00:00:00.000Z`) }),
  };
}
