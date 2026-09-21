export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)

// padStart es idempotente, así que cubre tanto el string ya paddeado como el entero crudo con el mismo helper.
export const docNumber = (prefix: string, number: number | string) =>
  `${prefix}-${String(number).padStart(6, '0')}`
