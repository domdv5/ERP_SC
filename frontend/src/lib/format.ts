export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)

// padStart es idempotente, así que cubre tanto el string ya paddeado como el entero crudo con el mismo helper.
export const docNumber = (prefix: string, number: number | string) =>
  `${prefix}-${String(number).padStart(6, '0')}`

// toLocaleDateString con month:'short' agrega un punto ("ago."); se saca para que quede "17 ago 2026".
const composeLocaleDate = (date: Date, timeZone: string) => {
  const day = date.toLocaleDateString('es-CO', { day: 'numeric', timeZone })
  const month = date.toLocaleDateString('es-CO', { month: 'short', timeZone }).replace('.', '')
  const year = date.toLocaleDateString('es-CO', { year: 'numeric', timeZone })
  return `${day} ${month} ${year}`
}

// Para campos @db.Date (Document.date, Egreso.date, ReciboCaja.date, dueDate): Prisma los serializa como medianoche UTC, leerlos en horario Bogotá corre el día uno atrás.
export const formatDateOnly = (iso: string | null) => {
  if (!iso) return '—'
  return composeLocaleDate(new Date(iso), 'UTC')
}

// Para timestamps @db.Timestamptz reales (createdAt, confirmedAt, appliedAt...): esos sí se leen en horario Bogotá para mostrar el día en que ocurrió el evento localmente.
export const formatBogotaDate = (iso: string) => composeLocaleDate(new Date(iso), 'America/Bogota')
