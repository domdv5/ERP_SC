interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
      <p className="text-red-500 text-sm font-medium">{message}</p>
      <button onClick={onRetry} className="text-xs text-content-faint underline">
        Reintentar
      </button>
    </div>
  )
}
