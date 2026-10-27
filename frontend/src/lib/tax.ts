// Tarifa de IVA de la facturación oficial (CMO/POSO); el backend aplica el mismo 19%.
export const OFFICIAL_TAX_PERCENT = 19

// IVA de una línea: round(subtotal × 19%) a 2 decimales, mismo redondeo que el backend.
export const computeOfficialLineTax = (subtotal: number) =>
  Math.round(subtotal * OFFICIAL_TAX_PERCENT) / 100

// Quita el IVA de un valor que lo trae incluido (costos de la CM); entero porque COP se maneja sin centavos.
export const removeOfficialTax = (valueWithTax: number) =>
  Math.round((valueWithTax * 100) / (100 + OFFICIAL_TAX_PERCENT))

// POSO: el precio trae IVA; base e IVA se separan sobre el total de la línea, mismo cálculo que el backend.
export function splitOfficialPrice(quantity: number, unitPriceWithTax: number) {
  const lineTotalCents = Math.round(quantity * unitPriceWithTax * 100)
  const subtotalCents = Math.round((lineTotalCents * 100) / (100 + OFFICIAL_TAX_PERCENT))
  return {
    subtotal: subtotalCents / 100,
    taxAmount: (lineTotalCents - subtotalCents) / 100,
    total: lineTotalCents / 100,
  }
}

export interface OfficialLine {
  quantity: number
  unitValue: number
}

export interface OfficialTotals {
  subtotal: number
  taxTotal: number
  total: number
}

// Totales de documento: el IVA se redondea por línea y luego se suma, nunca sobre el subtotal global.
export function computeOfficialTotals(lines: OfficialLine[]): OfficialTotals {
  let subtotal = 0
  let taxTotal = 0
  for (const line of lines) {
    const lineSubtotal = Math.round(line.quantity * line.unitValue * 100) / 100
    subtotal += lineSubtotal
    taxTotal += computeOfficialLineTax(lineSubtotal)
  }
  return { subtotal, taxTotal, total: subtotal + taxTotal }
}
