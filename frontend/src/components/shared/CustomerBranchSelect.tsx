import type { CustomerBranch } from '@/types'

interface CustomerBranchSelectProps {
  branches: CustomerBranch[]
  value: string
  onChange: (branchId: string) => void
  isLoading?: boolean
  extraOption?: { value: string; label: string }
}

export function CustomerBranchSelect({
  branches,
  value,
  onChange,
  isLoading,
  extraOption,
}: CustomerBranchSelectProps) {
  if (isLoading) return <div className="h-10 rounded-md bg-surface-hover animate-pulse" />
  if (branches.length === 0) return null

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-content-secondary">
        Sucursal <span className="text-red-500">*</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-md border-2 border-ui-border-medium bg-surface-raised text-content transition-colors focus:outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary"
      >
        <option value="">Selecciona una sucursal...</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
        {extraOption && <option value={extraOption.value}>{extraOption.label}</option>}
      </select>
    </div>
  )
}
