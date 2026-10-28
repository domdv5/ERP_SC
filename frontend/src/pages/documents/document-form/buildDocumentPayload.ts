import type { FormValues } from '../document-form.schema'

interface BuildDocumentPayloadOptions {
  needsCustomer: boolean
  hasBranches: boolean
  isEditing: boolean
}

export function buildDocumentPayload(
  values: FormValues,
  { needsCustomer, hasBranches, isEditing }: BuildDocumentPayloadOptions,
) {
  const branchId = needsCustomer && hasBranches ? values.customerBranchId : ''
  return {
    type: values.type,
    date: values.date,
    thirdPartyId: values.thirdPartyId || undefined,
    // Al editar, null suelta la sucursal vieja si el cliente cambió a uno sin sucursales.
    customerBranchId: needsCustomer ? branchId || (isEditing ? null : undefined) : undefined,
    sellerId:
      values.type === 'PV' || values.type === 'REM' ? values.sellerId || undefined : undefined,
    receiverId: values.type === 'CM' ? values.receiverId || undefined : undefined,
    warehouseId: values.type === 'T' ? values.warehouseId || undefined : undefined,
    sourceBinId: values.sourceBinId || undefined,
    destWarehouseId: values.destWarehouseId || undefined,
    destBinId: values.destBinId || undefined,
    adjustmentReason: values.type === 'EAI' ? values.adjustmentReason || undefined : undefined,
    // null explícito (no undefined): así viaja en el JSON y el backend borra el texto viejo si el motivo deja de ser "otro".
    adjustmentReasonOther:
      values.type === 'EAI' && values.adjustmentReason === 'otro'
        ? values.adjustmentReasonOther || undefined
        : null,
    // Solo la devolución en venta manda modalidad; el backend la exige para ese tipo.
    refundMethod: values.type === 'DVV' ? values.refundMethod || undefined : undefined,
    // Solo CM manda el flag (el backend lo rechaza en otros tipos); '' limpia la factura al desmarcarlo.
    officialPurchase: values.type === 'CM' ? Boolean(values.officialPurchase) : undefined,
    supplierInvoiceNumber:
      values.type === 'CM'
        ? values.officialPurchase
          ? values.supplierInvoiceNumber?.trim()
          : ''
        : values.type === 'CMO'
          ? values.supplierInvoiceNumber?.trim()
          : undefined,
    // Al editar, null suelta el vínculo con la CM; undefined lo dejaría intacto en BD.
    sourceDocumentId:
      values.type === 'CMO' ? values.sourceDocumentId || (isEditing ? null : undefined) : undefined,
    notes: values.notes || undefined,
    items: values.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost !== undefined && !isNaN(item.unitCost) ? item.unitCost : undefined,
      unitPrice:
        item.unitPrice !== undefined && !isNaN(item.unitPrice) ? item.unitPrice : undefined,
      observaciones: item.observaciones || undefined,
      addedAt: item.addedAt,
    })),
  }
}
