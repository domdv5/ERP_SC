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

/**
 * Combobox con búsqueda client-side para un campo de react-hook-form respaldado por un
 * catálogo pequeño ya cargado en memoria (marca, categoría, género, etc.) — envuelve
 * Controller + Combobox (modo no controlado) + el label, para no repetir este mismo
 * bloque en cada formulario que necesite este patrón.
 */
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
