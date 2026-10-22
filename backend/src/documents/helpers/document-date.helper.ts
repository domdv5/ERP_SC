import { todayInBogota } from '@/common/utils/date-range.util';

export function resolveDocumentDate(
  usesTodayDate: boolean,
  requested: string,
  now?: Date,
): Date;
export function resolveDocumentDate(
  usesTodayDate: boolean,
  requested: string | undefined,
  now?: Date,
): Date | undefined;
export function resolveDocumentDate(
  usesTodayDate: boolean,
  requested: string | undefined,
  now = new Date(),
): Date | undefined {
  if (usesTodayDate) return todayInBogota(now);
  return requested ? new Date(requested) : undefined;
}
