// Misma regla que backend/src/auth/password-rule.ts: solo para contraseñas nuevas, el login no la exige.
export const PASSWORD_RULE_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, con letras y números'

const RULE_PARTS = [
  { label: 'Mínimo 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Al menos una letra', test: (value: string) => /[A-Za-z]/.test(value) },
  { label: 'Al menos un número', test: (value: string) => /\d/.test(value) },
]

export type PasswordRuleCheck = { label: string; met: boolean }

export function checkPasswordRule(password: string): PasswordRuleCheck[] {
  return RULE_PARTS.map(({ label, test }) => ({ label, met: test(password) }))
}

export function isValidPassword(password: string): boolean {
  return checkPasswordRule(password).every((part) => part.met)
}
