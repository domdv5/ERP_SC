import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Alto aproximado del globo más un margen
const MIN_SPACE_ABOVE = 40

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  label: string
}

// Globo con createPortal para que el overflow de las tablas no lo corte; se abre con mouse, foco o toque
export function Tooltip({ content, children, label }: TooltipProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; below: boolean } | null>(
    null,
  )

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Cerca del borde superior el globo va debajo del ícono para no salirse de la pantalla
    const below = rect.top < MIN_SPACE_ABOVE
    setPosition({
      top: below ? rect.bottom + 6 : rect.top - 6,
      left: rect.left + rect.width / 2,
      below,
    })
  }
  const hide = () => setPosition(null)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (position ? hide() : show())}
        className="inline-flex items-center justify-center rounded p-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-secondary"
      >
        {children}
      </button>
      {position &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              transform: position.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              zIndex: 9999,
            }}
            className="pointer-events-none whitespace-nowrap rounded-md border-2 border-ui-border-medium bg-surface px-2.5 py-1 text-xs text-content shadow-md"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
