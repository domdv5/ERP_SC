import type { CustomerBranch } from '@/types'

interface CustomerBranchSelectProps {
  branches: CustomerBranch[]
  value: string
  onChange: (branchId: string) => void
  isLoading?: boolean
}

export function CustomerBranchSelect({
  branches,
  value,
  onChange,
  isLoading,
}: CustomerBranchSelectProps) {
  if (isLoading) return <div className="h-10 rounded-lg bg-surface-hover animate-pulse" />
  if (branches.length === 0) return null

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-content-secondary">
        Sucursal <span className="text-red-500">*</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
      >
        <option value="">Selecciona una sucursal...</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  )
}
