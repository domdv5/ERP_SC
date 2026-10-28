import { Check, X } from 'lucide-react'
import { checkPasswordRule } from '@/lib/password-rule'
import { cn } from '@/lib/utils'

interface PasswordRuleHintProps {
  value: string
}

export function PasswordRuleHint({ value }: PasswordRuleHintProps) {
  return (
    <ul aria-live="polite" className="mt-1.5 space-y-0.5">
      {checkPasswordRule(value).map(({ label, met }) => (
        <li
          key={label}
          className={cn(
            'flex items-center gap-1.5 text-xs',
            met ? 'text-emerald-700 dark:text-brand-secondary font-medium' : 'text-content-faint',
          )}
        >
          {met ? (
            <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
          ) : (
            <X className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          {label}
          <span className="sr-only">{met ? '(cumplido)' : '(pendiente)'}</span>
        </li>
      ))}
    </ul>
  )
}
