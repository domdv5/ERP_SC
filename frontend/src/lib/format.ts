export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)

// El número de documento a veces llega del backend ya con ceros a la izquierda (string) y a
// veces como entero crudo; padStart sobre un string ya paddeado es idempotente, así que ambos
// casos quedan cubiertos con el mismo helper.
export const docNumber = (prefix: string, number: number | string) =>
  `${prefix}-${String(number).padStart(6, '0')}`
