import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Combobox } from './Combobox'
import type { ComboboxOption } from './Combobox'

interface CatalogComboboxFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label: string
  options: ComboboxOption[]
  placeholder?: string
  disabled?: boolean
}

// Envuelve Controller + Combobox (modo no controlado) + label para catálogos chicos ya en memoria
export function CatalogComboboxField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  disabled,
}: CatalogComboboxFieldProps<T>) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">{label}</label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Combobox
            value={field.value ?? ''}
            onChange={(id) => field.onChange(id)}
            options={options}
            placeholder={placeholder}
            disabled={disabled}
          />
        )}
      />
    </div>
  )
}
