export const EGRESO_VOID_STATE = {
  select: { egreso: { select: { voidedAt: true } } },
} as const;

export const VOIDED_EGRESO_ROW = {
  egreso: { voidedAt: { not: null } },
} as const;

/** Un abono o saldo aplicado cuenta solo si no vino de un egreso anulado (sin egreso = pago histórico, sí cuenta). */
export function isActiveEgresoLink(link: {
  egreso: { voidedAt: Date | null } | null;
}): boolean {
  return !link.egreso || link.egreso.voidedAt === null;
}
