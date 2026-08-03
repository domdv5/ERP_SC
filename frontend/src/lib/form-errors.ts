import type { FieldErrors } from 'react-hook-form'

const FALLBACK_MESSAGE = 'Revisa los campos del formulario'

// Claves propias de un FieldError que nunca deben tratarse como un sub-campo anidado
// al recorrer el árbol (ver findFirstMessage).
const FIELD_ERROR_KEYS = new Set(['message', 'type', 'ref', 'types', 'root'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// react-hook-form anida errores en objetos y arrays (ej. errors.items[2].quantity.message
// para un array de ítems de documento) — se recorre recursivamente hasta encontrar el
// primer .message string, sin asumir una forma fija del árbol. Se tipa con `unknown` en
// el recorrido interno porque el árbol mezcla FieldError, arrays y objetos anidados sin
// una forma común expresable sin `any`; la firma pública (getFirstErrorMessage) sigue
// tipada con FieldErrors.
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

/**
 * Devuelve el primer mensaje de error encontrado en el árbol de FieldErrors de
 * react-hook-form (incluye errores anidados en arrays de ítems). Pensado para
 * mostrarse en un único toast (`toast.error`) en el callback `onInvalid` de
 * `handleSubmit`, en vez de renderizar cada error inline junto a su campo.
 */
export function getFirstErrorMessage(errors: FieldErrors): string {
  return findFirstMessage(errors) ?? FALLBACK_MESSAGE
}
