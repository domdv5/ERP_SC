import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCityLabel } from '@/lib/format'
import { useCities, useDepartments } from '@/hooks/useLocations'

interface CityPickerProps {
  value: string
  onChange: (cityCode: string, cityLabel: string) => void
  showLabels?: boolean
  className?: string
}

const SELECT_CLASS = 'input-hard w-full px-3 py-2 text-sm'

export function CityPicker({ value, onChange, showLabels = false, className }: CityPickerProps) {
  const [pickedDepartment, setPickedDepartment] = useState('')
  // Los 2 primeros dígitos del código DANE del municipio son su departamento
  const departmentCode = value ? value.slice(0, 2) : pickedDepartment

  const { data: departments = [] } = useDepartments()
  const { data: cities = [], isLoading: citiesLoading } = useCities(departmentCode)

  function handleDepartmentChange(code: string) {
    setPickedDepartment(code)
    onChange('', '')
  }

  function handleCityChange(code: string) {
    const city = cities.find((c) => c.code === code)
    const department = departments.find((d) => d.code === departmentCode)
    onChange(code, city && department ? formatCityLabel(city.name, department.name) : '')
  }

  const departmentSelect = (
    <select
      className={SELECT_CLASS}
      value={departmentCode}
      onChange={(e) => handleDepartmentChange(e.target.value)}
      aria-label="Departamento"
    >
      <option value="">Departamento</option>
      {departments.map((d) => (
        <option key={d.code} value={d.code}>
          {d.name}
        </option>
      ))}
    </select>
  )

  const citySelect = (
    <select
      className={SELECT_CLASS}
      value={value}
      onChange={(e) => handleCityChange(e.target.value)}
      disabled={!departmentCode || citiesLoading}
      aria-label="Ciudad"
    >
      <option value="">{citiesLoading ? 'Cargando…' : 'Ciudad'}</option>
      {cities.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  )

  if (!showLabels) {
    return (
      <div className={cn('grid grid-cols-2 gap-2', className)}>
        {departmentSelect}
        {citySelect}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-2 gap-4', className)}>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          Departamento
        </label>
        {departmentSelect}
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Ciudad</label>
        {citySelect}
      </div>
    </div>
  )
}
