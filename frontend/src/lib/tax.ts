// Tarifa de IVA de la facturación oficial (CMO/POSO); el backend aplica el mismo 19%.
export const OFFICIAL_TAX_PERCENT = 19

// IVA de una línea: round(subtotal × 19%) a 2 decimales, mismo redondeo que el backend.
export const computeOfficialLineTax = (subtotal: number) =>
  Math.round(subtotal * OFFICIAL_TAX_PERCENT) / 100

// Quita el IVA de un valor que lo trae incluido (costos de la CM); entero porque COP se maneja sin centavos.
export const removeOfficialTax = (valueWithTax: number) =>
  Math.round((valueWithTax * 100) / (100 + OFFICIAL_TAX_PERCENT))

// Precio de venta sin IVA para POSO: hacia arriba, para no quedar nunca por debajo de officialNetFloor.
export const officialNetSalePrice = (salePriceWithTax: number) =>
  Math.ceil((salePriceWithTax * 100) / (100 + OFFICIAL_TAX_PERCENT))

// Inverso de removeOfficialTax: vuelve a sumar el IVA al salir del modo oficial del POS.
export const addOfficialTax = (valueWithoutTax: number) =>
  Math.round((valueWithoutTax * (100 + OFFICIAL_TAX_PERCENT)) / 100)

// Piso de precio sin IVA para POSO (minSalePrice trae IVA); redondeo hacia arriba como el backend.
export const officialNetFloor = (minSalePriceWithTax: number) =>
  Math.ceil((minSalePriceWithTax * 100 * 100) / (100 + OFFICIAL_TAX_PERCENT)) / 100

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
