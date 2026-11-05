import type { InventoryCaseCause, InventoryCaseMovement } from '@/types/inventory-case.types'

// Record exige listar todas las causas del contrato: si el backend agrega una, no compila hasta sumarla aquí.
const CAUSE_LABELS: Record<InventoryCaseCause, string> = {
  venta_otro_producto: 'Venta facturada con otro producto',
  traslado_mal_registrado: 'Traslado no registrado o mal registrado',
  compra_mal_digitada: 'Compra mal digitada',
  devolucion_no_registrada: 'Devolución no registrada',
  error_conteo: 'Error en conteo',
  perdida_faltante: 'Pérdida o faltante',
  otro: 'Otro',
  ajuste_anulado: 'Ajuste anulado',
}

// Orden del select de cierre; 'ajuste_anulado' solo lo pone el sistema, por eso no entra.
export const CLOSABLE_CAUSES = [
  'venta_otro_producto',
  'traslado_mal_registrado',
  'compra_mal_digitada',
  'devolucion_no_registrada',
  'error_conteo',
  'perdida_faltante',
  'otro',
] as const satisfies readonly Exclude<InventoryCaseCause, 'ajuste_anulado'>[]

export const CLOSABLE_CAUSE_OPTIONS = CLOSABLE_CAUSES.map((value) => ({
  value,
  label: CAUSE_LABELS[value],
}))

export const getCauseLabel = (cause: InventoryCaseCause) => CAUSE_LABELS[cause]

export const JUSTIFICATION_MAX_LENGTH = 1000
export const OVERDUE_DAYS = 7

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'Compra',
  sale: 'Venta',
  return: 'Devolución',
  adjustment: 'Ajuste',
  initial_stock: 'Stock inicial',
  void: 'Anulación',
  production: 'Producción',
}

// El traslado se parte en entrada/salida según el signo de la cantidad.
export function getMovementLabel(
  movement: Pick<InventoryCaseMovement, 'movementType' | 'quantity'>,
) {
  if (movement.movementType === 'transfer') {
    return movement.quantity >= 0 ? 'Traslado entrada' : 'Traslado salida'
  }
  return MOVEMENT_LABELS[movement.movementType] ?? movement.movementType
}

export function formatSignedQuantity(quantity: number) {
  if (quantity > 0) return `+${quantity}`
  if (quantity < 0) return `−${Math.abs(quantity)}`
  return '0'
}
