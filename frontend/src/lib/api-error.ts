// El backend manda `message` como texto o, si falla la validación del DTO, como lista
export function findApiErrorMessage(err: unknown): string | undefined {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  const first = Array.isArray(message) ? message[0] : message
  return typeof first === 'string' && first.length > 0 ? first : undefined
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  return findApiErrorMessage(err) ?? fallback
}
