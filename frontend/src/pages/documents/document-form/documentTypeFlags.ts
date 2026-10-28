import { DOC_TYPE_ACCENT } from '../document.constants'
import type { FormValues } from '../document-form.schema'
import { FIXED_TYPE_LABEL } from './documentTypeLabels'

export function getDocumentTypeFlags(docType: FormValues['type']) {
  // Ícono y color de acento del encabezado; se recalculan en vivo al cambiar el tipo de operación.
  const accent = DOC_TYPE_ACCENT[docType]
  // Tipos que llegan con el tipo ya fijado por deep-link: el selector se reemplaza por un pill
  // no editable.
  const isFixedType = docType === 'REM' || docType === 'DVV' || docType === 'CMO'
  const fixedTypeLabel = FIXED_TYPE_LABEL[docType] ?? ''

  // CM/DVC piden proveedor; PV, REM y DVV piden cliente — mismo combobox, distinto filtro
  // server-side. La devolución en venta no lleva vendedora (v1, igual que la devolución compra).
  const needsSupplier = docType === 'CM' || docType === 'DVC' || docType === 'CMO'
  const needsCustomer = docType === 'PV' || docType === 'REM' || docType === 'DVV'
  const needsSeller = docType === 'PV' || docType === 'REM'
  const isTodayOnly = docType === 'REM'
  const needsReceiver = docType === 'CM'

  const needsThirdParty = needsSupplier || needsCustomer
  const needsTransfer = docType === 'T'
  const needsAdjustmentReason = docType === 'EAI'
  const isOfficialPurchaseDoc = docType === 'CMO'
  const showCostColumn =
    docType === 'CM' || docType === 'DVC' || docType === 'EAI' || docType === 'CMO'
  // Preventas, remisiones y devoluciones en venta muestran precio de venta editable en vez de
  // costo: es una columna aparte.
  const showPriceColumn = docType === 'PV' || docType === 'REM' || docType === 'DVV'
  // Las salidas por ajuste y los traslados también necesitan la columna de costo (de solo
  // lectura) para que las celdas de cada fila sigan alineadas con el encabezado.
  const hasCostColumn = showCostColumn || showPriceColumn || docType === 'SAJ' || docType === 'T'
  // Nota de talla por línea: solo en traslados.
  const showObservacionesColumn = docType === 'T'
  const showTimeColumn = docType === 'REM' || docType === 'DVV'

  return {
    accent,
    isFixedType,
    fixedTypeLabel,
    needsSupplier,
    needsCustomer,
    needsSeller,
    isTodayOnly,
    needsReceiver,
    needsThirdParty,
    needsTransfer,
    needsAdjustmentReason,
    isOfficialPurchaseDoc,
    showCostColumn,
    showPriceColumn,
    hasCostColumn,
    showObservacionesColumn,
    showTimeColumn,
  }
}

export type DocumentTypeFlags = ReturnType<typeof getDocumentTypeFlags>
