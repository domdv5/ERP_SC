interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
      <p className="text-red-500 text-sm font-semibold">{message}</p>
      <button onClick={onRetry} className="btn-secondary mt-1 px-3 py-1.5 text-xs">
        Reintentar
      </button>
    </div>
  )
}
