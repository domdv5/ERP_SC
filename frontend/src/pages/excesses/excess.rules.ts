import type { CreateExcessBody, ExcessPartyType, ExcessVoidReason } from '@contracts/excesses'

export const NO_BRANCH = 'none'
export const MAX_VOID_REASON_LENGTH = 500

export const VOID_REASON_LABELS: Record<ExcessVoidReason, string> = {
  valor_mal_digitado: 'Valor mal digitado',
  tercero_equivocado: 'Tercero equivocado',
  otro: 'Otro',
}

interface ExcessFormValues {
  thirdPartyId: string
  hasBranches: boolean
  branchId: string
  amount: number | undefined
  date: string
  today: string
}

export function findExcessFormError(values: ExcessFormValues): string | null {
  if (!values.thirdPartyId) return 'Selecciona el tercero'
  if (values.hasBranches && !values.branchId) return 'Selecciona una sucursal'
  if (!values.amount || values.amount <= 0) return 'El valor debe ser mayor que 0'
  if (!values.date) return 'La fecha es requerida'
  if (values.date > values.today) return 'La fecha no puede ser futura'
  return null
}

export function buildCreateExcessBody(
  partyType: ExcessPartyType,
  values: ExcessFormValues,
): CreateExcessBody {
  const useBranch = partyType === 'customer' && values.hasBranches && values.branchId !== NO_BRANCH
  return {
    partyType,
    thirdPartyId: values.thirdPartyId,
    customerBranchId: useBranch ? values.branchId : undefined,
    amount: values.amount ?? 0,
    date: values.date,
  }
}

// "Otro" exige texto; los demás motivos no mandan texto
export function canConfirmVoid(reason: ExcessVoidReason | '', reasonOther: string): boolean {
  if (reason === '') return false
  return reason !== 'otro' || reasonOther.trim().length > 0
}
