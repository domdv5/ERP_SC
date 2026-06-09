interface TableSkeletonProps {
  rows?: number
  widths?: [string, string, string, string]
}

export function TableSkeleton({
  rows = 5,
  widths = ['w-40', 'w-28', 'w-16', 'w-24'],
}: TableSkeletonProps) {
  const [w1, w2, w3, w4] = widths
  return (
    <div className="divide-y divide-ui-divide">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-surface-hover shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className={`h-3 bg-surface-hover rounded ${w1}`} />
            <div className={`h-2.5 bg-surface-hover rounded ${w2}`} />
          </div>
          <div className={`h-5 bg-surface-hover rounded-full ${w3}`} />
          <div className={`h-3 bg-surface-hover rounded ${w4}`} />
        </div>
      ))}
    </div>
  )
}
