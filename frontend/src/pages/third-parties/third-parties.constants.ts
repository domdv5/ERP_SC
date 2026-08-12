import type { WithholdingAgentType, TaxRegime } from '@/types/third-party.types'

export const WITHHOLDING_AGENT_TYPE_OPTIONS: { value: WithholdingAgentType; label: string }[] = [
  { value: 'ninguno', label: 'Ninguno' },
  { value: 'gran_contribuyente', label: 'Gran Contribuyente' },
  { value: 'autorretenedor_renta', label: 'Autorretenedor de renta' },
  { value: 'agente_retencion_iva', label: 'Agente de retención de IVA' },
]

export const TAX_REGIME_OPTIONS: { value: TaxRegime; label: string }[] = [
  { value: 'ordinario', label: 'Régimen Ordinario' },
  { value: 'rst', label: 'Régimen Simple de Tributación (RST)' },
  { value: 'no_aplica', label: 'No aplica' },
]

export const IVA_RESPONSIBLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
]
