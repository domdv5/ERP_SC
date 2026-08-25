import {
  ShoppingCart,
  Undo2,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  CalendarClock,
  Banknote,
  type LucideIcon,
} from 'lucide-react'

import type { DocumentType, DocumentStatus, EaiAdjustmentReason } from '@/types/document.types'

// Etiquetas completas — usadas en el filtro de tipo del listado (DocumentsPage) y en el
// <select> "Tipo de operación" de DocumentFormPage. POS se agrega aquí solo para que aparezca
// como filtro en el listado — DocumentFormPage lo excluye explícitamente de sus opciones
// seleccionables (tiene su propia pantalla de checkout, ver POSCheckoutPage). Difieren a
// propósito de DOC_TYPE_BADGE (etiquetas cortas para pills de tabla/detalle) — ej. "Devolución
// compra" vs "Dev. Compra".
export const DOC_TYPE_SELECT_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'CM',  label: 'Compra' },
  { value: 'DVC', label: 'Devolución compra' },
  { value: 'EAI', label: 'Entrada ajuste' },
  { value: 'SAJ', label: 'Salida ajuste' },
  { value: 'T',   label: 'Traslado' },
  { value: 'PV',  label: 'Preventa' },
  { value: 'POS', label: 'Venta (POS)' },
]

// Motivo del ajuste — solo documentos EAI. Etiquetas orientadas al usuario final (operador de
// tienda haciendo ajustes de inventario), no al nombre técnico del enum.
export const EAI_ADJUSTMENT_REASON_OPTIONS: { value: EaiAdjustmentReason; label: string }[] = [
  { value: 'negativo',           label: 'Negativo' },
  { value: 'inventario_general', label: 'Inventario general' },
  { value: 'traspaso_costo',     label: 'Traspaso de costo desde otro producto' },
  { value: 'otro',               label: 'Otro' },
]

// Pill de tipo — usada en DocumentsPage (listado) y DocumentDetailPage (encabezado).
export const DOC_TYPE_BADGE: Record<DocumentType, { label: string; className: string }> = {
  CM:  { label: 'Compra',          className: 'bg-blue-100   text-blue-700   dark:bg-blue-500/20   dark:text-blue-400'   },
  DVC: { label: 'Dev. Compra',     className: 'bg-amber-100  text-amber-700  dark:bg-amber-500/20  dark:text-amber-400'  },
  EAI: { label: 'Entrada Ajuste',  className: 'bg-teal-100   text-teal-700   dark:bg-teal-500/20   dark:text-teal-400'   },
  SAJ: { label: 'Salida Ajuste',   className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  T:   { label: 'Traslado',        className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  PV:  { label: 'Preventa',        className: 'bg-pink-100   text-pink-700   dark:bg-pink-500/20   dark:text-pink-400'   },
  POS: { label: 'Venta',           className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
}

// Refuerzo visual "a simple vista" del tipo (ícono + borde de acento izquierdo) — usado en el
// header de DocumentDetailPage y DocumentFormPage. Reusa deliberadamente la misma paleta por tipo
// que DOC_TYPE_BADGE (mismo bg-*/text-* por color) en vez de definir colores nuevos, para que pill,
// ícono y borde compartan un único mapeo mental "este color = este tipo de operación".
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
  POS: { icon: Banknote,       iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', iconText: 'text-emerald-700 dark:text-emerald-400', border: 'border-l-emerald-500' },
}

// Pill de estado — usada en DocumentsPage y DocumentDetailPage.
export const DOC_STATUS_BADGE: Record<DocumentStatus, { label: string; className: string }> = {
  draft:     { label: 'Borrador',   className: 'bg-gray-100  text-gray-600  dark:bg-gray-500/20  dark:text-gray-400'  },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  voided:    { label: 'Anulado',    className: 'bg-red-100   text-red-700   dark:bg-red-500/20   dark:text-red-400'   },
}
