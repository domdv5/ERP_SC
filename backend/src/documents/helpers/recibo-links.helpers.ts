export const RECIBO_VOID_STATE = {
  select: { reciboCaja: { select: { voidedAt: true } } },
} as const;

export const ACTIVE_RECIBO_LINK = {
  OR: [{ reciboCajaId: null }, { reciboCaja: { voidedAt: null } }],
};

export const VOIDED_RECIBO_ROW = {
  reciboCaja: { voidedAt: { not: null } },
} as const;

/** Un abono o saldo aplicado cuenta solo si no vino de un recibo anulado. */
export function isActiveReciboLink(link: {
  reciboCaja: { voidedAt: Date | null } | null;
}): boolean {
  return !link.reciboCaja || link.reciboCaja.voidedAt === null;
}
