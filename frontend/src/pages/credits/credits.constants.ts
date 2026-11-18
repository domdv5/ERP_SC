import type { CreditStatus } from '@contracts/credits'

export type CreditsTab = 'clientes' | 'proveedores'

export const CREDIT_STATUS_BADGE: Record<CreditStatus, { label: string; className: string }> = {
  available: {
    label: 'Disponible',
    className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  },
  partial: {
    label: 'Usado en parte',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  },
  used: {
    label: 'Usado',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  },
  voided: {
    label: 'Anulado',
    className: 'bg-red-100/60 text-red-700/70 dark:bg-red-500/10 dark:text-red-400/70',
  },
}

export const USABLE_IN_LABEL = {
  facturacion: 'Facturación',
  administracion: 'Administración',
} as const
