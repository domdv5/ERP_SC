import type { FieldErrors } from 'react-hook-form'

const FALLBACK_MESSAGE = 'Revisa los campos del formulario'

// Claves propias de un FieldError que nunca deben tratarse como un sub-campo anidado
// al recorrer el árbol (ver findFirstMessage).
const FIELD_ERROR_KEYS = new Set(['message', 'type', 'ref', 'types', 'root'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Recorre el árbol recursivamente porque react-hook-form anida errores en arrays (ej. errors.items[2].quantity.message)
function findFirstMessage(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined

  if (typeof node.message === 'string' && node.message.length > 0) {
    return node.message
  }

  for (const key of Object.keys(node)) {
    if (FIELD_ERROR_KEYS.has(key)) continue
    const found = findFirstMessage(node[key])
    if (found) return found
  }

  return undefined
}

// Para mostrar en un único toast.error desde onInvalid, en vez de un error inline por campo
export function getFirstErrorMessage(errors: FieldErrors): string {
  return findFirstMessage(errors) ?? FALLBACK_MESSAGE
}
