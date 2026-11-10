// El backend manda `message` como texto o, si falla la validación del DTO, como lista
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  const first = Array.isArray(message) ? message[0] : message
  return typeof first === 'string' && first.length > 0 ? first : fallback
}
