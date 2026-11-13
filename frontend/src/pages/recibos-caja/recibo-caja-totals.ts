import type { ReciboCajaListItem } from '@contracts/recibos-caja'

const toCents = (value: string) => Math.round(Number(value) * 100)

// Total del recibo = lo que bajó la deuda: dinero + saldo a favor + descuento (igual que el total de egresos)
export function calculateReciboTotal(
  reciboCaja: Pick<ReciboCajaListItem, 'cashTotal' | 'creditTotal' | 'discountAmount'>,
): number {
  return (
    (toCents(reciboCaja.cashTotal) +
      toCents(reciboCaja.creditTotal) +
      toCents(reciboCaja.discountAmount)) /
    100
  )
}
