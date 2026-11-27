import type { CreateExcessBody, ExcessPartyType, ExcessVoidReason } from '@contracts/excesses'

export const NO_BRANCH = 'none'
export const MAX_VOID_REASON_LENGTH = 500

export const VOID_REASON_LABELS: Record<ExcessVoidReason, string> = {
  valor_mal_digitado: 'Valor mal digitado',
  tercero_equivocado: 'Tercero equivocado',
  otro: 'Otro',
}

// Proveedores y clientes sin elegir quedan 'ready': no hay sucursales que esperar
export type BranchesState = 'ready' | 'loading' | 'failed'

interface ExcessFormValues {
  thirdPartyId: string
  hasBranches: boolean
  branchesState: BranchesState
  branchId: string
  amount: number | undefined
  date: string
  today: string
}

export function findExcessFormError(values: ExcessFormValues): string | null {
  if (!values.thirdPartyId) return 'Selecciona el tercero'
  // Sin la lista de sucursales no se sabe si hay que elegir una: guardaría "Sin sucursal" por error
  if (values.branchesState === 'loading') return 'Espera a que carguen las sucursales del cliente'
  if (values.branchesState === 'failed') {
    return 'No se pudieron cargar las sucursales del cliente. Intenta de nuevo'
  }
  if (values.hasBranches && !values.branchId) return 'Selecciona una sucursal'
  if (!values.amount || values.amount <= 0) return 'El valor debe ser mayor que 0'
  if (!values.date) return 'La fecha es requerida'
  if (values.date > values.today) return 'La fecha no puede ser futura'
  return null
}

export function buildCreateExcessBody(
  partyType: ExcessPartyType,
  values: ExcessFormValues,
  idempotencyKey: string,
): CreateExcessBody {
  const useBranch = partyType === 'customer' && values.hasBranches && values.branchId !== NO_BRANCH
  return {
    partyType,
    thirdPartyId: values.thirdPartyId,
    customerBranchId: useBranch ? values.branchId : undefined,
    amount: values.amount ?? 0,
    date: values.date,
    idempotencyKey,
  }
}

// "Otro" exige texto; los demás motivos no mandan texto
export function canConfirmVoid(reason: ExcessVoidReason | '', reasonOther: string): boolean {
  if (reason === '') return false
  return reason !== 'otro' || reasonOther.trim().length > 0
}
