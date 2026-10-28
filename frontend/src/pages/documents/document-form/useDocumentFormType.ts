import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { operationFormTypes } from '../document.constants'
import type { FormValues } from '../document-form.schema'

export function useDocumentFormType(isEditing: boolean) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])
  const canCreateType = (t: string) => userPermissions.includes(`document.create.${t}`)

  const availableTypes = operationFormTypes(userPermissions)

  // Tipos que solo se pueden crear desde un enlace directo, no desde el desplegable.
  const DEEP_LINK_TYPES: readonly FormValues['type'][] = ['REM', 'DVV', 'CMO']
  const requestedType = searchParams.get('type') as FormValues['type'] | null
  const requestedTypeAllowed =
    requestedType != null &&
    canCreateType(requestedType) &&
    (DEEP_LINK_TYPES.includes(requestedType) ||
      availableTypes.some((opt) => opt.value === requestedType))
  const defaultType = (
    requestedTypeAllowed ? requestedType : (availableTypes[0]?.value ?? 'CM')
  ) as FormValues['type']

  // Si el enlace pide crear un tipo para el que el usuario no tiene permiso, no romper:
  // mandarlo al listado. Al editar, el tipo lo fija el documento existente.
  useEffect(() => {
    if (isEditing || !requestedType || canCreateType(requestedType)) return
    toast.error('No tienes permiso para crear este tipo de documento')
    navigate('/documents', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedType, isEditing])

  // Sin tipos para el desplegable ni enlace válido no hay qué crear (el caso del enlace sin permiso ya avisa arriba).
  useEffect(() => {
    if (isEditing || requestedTypeAllowed || availableTypes.length > 0) return
    if (requestedType && !canCreateType(requestedType)) return
    toast.error('No tienes operaciones disponibles para crear')
    navigate('/documents', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, requestedTypeAllowed, availableTypes.length])

  return { availableTypes, defaultType }
}
