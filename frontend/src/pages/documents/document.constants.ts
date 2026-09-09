import {
  ShoppingCart,
  Undo2,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  CalendarClock,
  Banknote,
  CreditCard,
  Truck,
  type LucideIcon,
} from 'lucide-react'

import type { DocumentType, DocumentStatus, EaiAdjustmentReason } from '@/types/document.types'

// Etiquetas largas — se usan en el filtro de tipo del listado y en el selector "Tipo de
// operación" del formulario. Las ventas aparecen acá solo para poder filtrar el listado; el
// formulario las excluye de sus opciones porque tienen su propia pantalla de checkout. A
// propósito son distintas de las etiquetas cortas de los pills (ej. "Devolución compra" vs "Dev. Compra").
export const DOC_TYPE_SELECT_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'CM',  label: 'Compra' },
  { value: 'DVC', label: 'Devolución compra' },
  { value: 'EAI', label: 'Entrada ajuste' },
  { value: 'SAJ', label: 'Salida ajuste' },
  { value: 'T',   label: 'Traslado' },
  { value: 'PV',  label: 'Preventa' },
  { value: 'REM', label: 'Remisión' },
  { value: 'POS', label: 'Venta (POS)' },
  { value: 'COT', label: 'Venta crédito' },
]

// Motivo del ajuste — solo en entradas por ajuste. Etiquetas pensadas para el operador de
// tienda, no el nombre técnico interno.
export const EAI_ADJUSTMENT_REASON_OPTIONS: { value: EaiAdjustmentReason; label: string }[] = [
  { value: 'negativo',           label: 'Negativo' },
  { value: 'inventario_general', label: 'Inventario general' },
  { value: 'traspaso_costo',     label: 'Traspaso de costo desde otro producto' },
  { value: 'otro',               label: 'Otro' },
]

// Pill de tipo — se usa en el listado y en el encabezado del detalle.
export const DOC_TYPE_BADGE: Record<DocumentType, { label: string; className: string }> = {
  CM:  { label: 'Compra',          className: 'bg-blue-100   text-blue-700   dark:bg-blue-500/20   dark:text-blue-400'   },
  DVC: { label: 'Dev. Compra',     className: 'bg-amber-100  text-amber-700  dark:bg-amber-500/20  dark:text-amber-400'  },
  EAI: { label: 'Entrada Ajuste',  className: 'bg-teal-100   text-teal-700   dark:bg-teal-500/20   dark:text-teal-400'   },
  SAJ: { label: 'Salida Ajuste',   className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  T:   { label: 'Traslado',        className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  PV:  { label: 'Preventa',        className: 'bg-pink-100   text-pink-700   dark:bg-pink-500/20   dark:text-pink-400'   },
  REM: { label: 'Remisión',        className: 'bg-cyan-100   text-cyan-700   dark:bg-cyan-500/20   dark:text-cyan-400'   },
  POS: { label: 'Venta',           className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  COT: { label: 'Venta crédito',   className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' },
}

// Refuerzo visual del tipo a simple vista (ícono + borde de acento a la izquierda). Se usa en
// el encabezado del detalle y del formulario. Reutiliza a propósito los mismos colores por tipo
// que los pills, para que pill, ícono y borde compartan una sola idea: "este color = este tipo".
export const DOC_TYPE_ACCENT: Record<DocumentType, {
  icon: LucideIcon
  iconBg: string
  iconText: string
  border: string
}> = {
  CM:  { icon: ShoppingCart,   iconBg: 'bg-blue-100   dark:bg-blue-500/20',   iconText: 'text-blue-700   dark:text-blue-400',   border: 'border-l-blue-500'   },
  DVC: { icon: Undo2,          iconBg: 'bg-amber-100  dark:bg-amber-500/20',  iconText: 'text-amber-700  dark:text-amber-400',  border: 'border-l-amber-500'  },
  EAI: { icon: PackagePlus,    iconBg: 'bg-teal-100   dark:bg-teal-500/20',   iconText: 'text-teal-700   dark:text-teal-400',   border: 'border-l-teal-500'   },
  SAJ: { icon: PackageMinus,   iconBg: 'bg-orange-100 dark:bg-orange-500/20', iconText: 'text-orange-700 dark:text-orange-400', border: 'border-l-orange-500' },
  T:   { icon: ArrowLeftRight, iconBg: 'bg-purple-100 dark:bg-purple-500/20', iconText: 'text-purple-700 dark:text-purple-400', border: 'border-l-purple-500' },
  PV:  { icon: CalendarClock,  iconBg: 'bg-pink-100   dark:bg-pink-500/20',   iconText: 'text-pink-700   dark:text-pink-400',   border: 'border-l-pink-500'   },
  REM: { icon: Truck,          iconBg: 'bg-cyan-100   dark:bg-cyan-500/20',   iconText: 'text-cyan-700   dark:text-cyan-400',   border: 'border-l-cyan-500'   },
  POS: { icon: Banknote,       iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', iconText: 'text-emerald-700 dark:text-emerald-400', border: 'border-l-emerald-500' },
  COT: { icon: CreditCard,     iconBg: 'bg-indigo-100 dark:bg-indigo-500/20', iconText: 'text-indigo-700 dark:text-indigo-400', border: 'border-l-indigo-500' },
}

// Chip de estado de conversión de una preventa o remisión — bajo el pill de estado en el
// listado y junto a los pills de tipo y estado en el detalle. Solo se muestra en "pending" y
// "converted" ("none" no muestra nada). Violeta y ámbar elegidos a propósito para no chocar
// con el verde de "confirmado" ni con el rosa de la preventa.
export const PV_CONVERSION_BADGE: Record<'pending' | 'converted', { label: string; className: string }> = {
  pending:   { label: 'En conversión', className: 'bg-amber-100  text-amber-700  dark:bg-amber-500/20  dark:text-amber-400'  },
  converted: { label: 'Convertida',    className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400' },
}

// Pill de estado — se usa en el listado y en el detalle.
export const DOC_STATUS_BADGE: Record<DocumentStatus, { label: string; className: string }> = {
  draft:     { label: 'Borrador',   className: 'bg-gray-100  text-gray-600  dark:bg-gray-500/20  dark:text-gray-400'  },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  voided:    { label: 'Anulado',    className: 'bg-red-100   text-red-700   dark:bg-red-500/20   dark:text-red-400'   },
}
