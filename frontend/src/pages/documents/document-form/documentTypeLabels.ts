// Sustantivo por tipo para títulos y botones: la remisión y la devolución en venta tienen
// texto propio; el resto usa "operación".
const TYPE_LABEL: Record<string, string> = {
  REM: 'remisión',
  DVV: 'devolución en venta',
  CMO: 'compra oficial',
}
export const FIXED_TYPE_LABEL: Record<string, string> = {
  REM: 'Remisión',
  DVV: 'Devolución en venta',
  CMO: 'Compra oficial',
}
export const typeLabelFor = (t: string) => TYPE_LABEL[t] ?? 'operación'
