import { z } from 'zod'
import { CLOSABLE_CAUSES, JUSTIFICATION_MAX_LENGTH } from './inventory-cases.constants'

export const closeCaseSchema = z.object({
  cause: z.enum(CLOSABLE_CAUSES, { error: 'Selecciona una causa' }),
  justification: z
    .string()
    .trim()
    .min(1, 'La justificación es obligatoria')
    .max(
      JUSTIFICATION_MAX_LENGTH,
      `La justificación no puede superar los ${JUSTIFICATION_MAX_LENGTH} caracteres`,
    ),
})

export type CloseCaseFormData = z.infer<typeof closeCaseSchema>
