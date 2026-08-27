import { forwardRef, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Formatea con separador de miles es-CO ('.') solo para presentación; el valor que sale por
// onChange es siempre el number crudo (o undefined si el campo queda vacío). Mismo patrón que
// el ThousandsInput local de ProductForm, extraído acá para reusarlo (ej. límite de crédito
// en ThirdPartyForm).
const formatThousands = (value: number): string => new Intl.NumberFormat('es-CO').format(value)

interface ThousandsInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  onBlur?: () => void
  name?: string
  id?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export const ThousandsInput = forwardRef<HTMLInputElement, ThousandsInputProps>(function ThousandsInput(
  { value, onChange, onBlur, name, id, placeholder, disabled, autoFocus, className },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Posición de cursor a restaurar tras reformatear — evita que salte al final en cada tecleo.
  const caretRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (caretRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current)
      caretRef.current = null
    }
  })

  return (
    <input
      ref={(node) => {
        inputRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      }}
      inputMode="numeric"
      name={name}
      id={id}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      value={value === undefined || Number.isNaN(value) ? '' : formatThousands(value)}
      onBlur={onBlur}
      onChange={(e) => {
        const el = e.target
        const caretPos = el.selectionStart ?? el.value.length
        const digitsBeforeCaret = el.value.slice(0, caretPos).replace(/\D/g, '').length
        const rawDigits = el.value.replace(/\D/g, '')
        const numericValue = rawDigits ? Number(rawDigits) : undefined
        const newFormatted = numericValue === undefined ? '' : formatThousands(numericValue)

        // Recalcula dónde debe quedar el cursor contando dígitos (no caracteres, por los puntos).
        let newCaret = digitsBeforeCaret === 0 ? 0 : newFormatted.length
        let seen = 0
        for (let i = 0; i < newFormatted.length; i++) {
          if (/\d/.test(newFormatted[i])) {
            seen++
            if (seen === digitsBeforeCaret) {
              newCaret = i + 1
              break
            }
          }
        }
        caretRef.current = newCaret

        onChange(numericValue)
      }}
      className={cn(
        'w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
    />
  )
})
