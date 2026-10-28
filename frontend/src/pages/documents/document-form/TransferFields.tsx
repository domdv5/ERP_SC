import { Controller, type Control, type UseFormSetValue } from 'react-hook-form'
import { cn } from '@/lib/utils'
import type { Warehouse } from '@/types/warehouse.types'
import type { FormValues } from '../document-form.schema'
import type { TransferLocations } from './useTransferLocations'

interface TransferFieldsProps {
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  transfer: TransferLocations
}

// Traslado: bodega origen y destino
export function TransferFields({ control, setValue, transfer }: TransferFieldsProps) {
  const {
    warehouses,
    warehouseId,
    sourceRequiresBin,
    destRequiresBin,
    isLoadingSourceDetail,
    isLoadingDestDetail,
    sourceZones,
    destZones,
    selectedSourceZoneId,
    setSelectedSourceZoneId,
    selectedZoneId,
    setSelectedZoneId,
    sourceBins,
    destBins,
  } = transfer

  return (
    <>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-content-secondary">
          Bodega origen <span className="text-red-500">*</span>
        </label>
        <Controller
          name="warehouseId"
          control={control}
          render={({ field }) => (
            <select
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
              className="input-hard w-full px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
            >
              <option value="">Selecciona bodega origen</option>
              {warehouses.map((w: Warehouse) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Cascada zona + bulto cuando el origen es una bodega física */}
      {sourceRequiresBin && (
        <>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-secondary">
              Zona origen <span className="text-red-500">*</span>
            </label>
            {isLoadingSourceDetail ? (
              <div className="h-9 rounded-lg bg-surface-hover animate-pulse" />
            ) : (
              <select
                value={selectedSourceZoneId}
                onChange={(e) => {
                  setSelectedSourceZoneId(e.target.value)
                  setValue('sourceBinId', undefined)
                }}
                className="input-hard w-full px-3 py-2 text-sm border-ui-border-medium text-content transition-all"
              >
                <option value="">Selecciona una zona</option>
                {sourceZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-secondary">
              Bulto origen <span className="text-red-500">*</span>
            </label>
            <Controller
              name="sourceBinId"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={!selectedSourceZoneId}
                  className={cn(
                    'input-hard w-full px-3 py-2 text-sm text-content transition-all',

                    !selectedSourceZoneId && 'opacity-50 cursor-not-allowed',
                    'border-ui-border-medium',
                  )}
                >
                  <option value="">Selecciona un bulto</option>
                  {sourceBins.map((b) => (
                    <option key={b.id} value={b.id}>
                      Bulto {b.code}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-content-secondary">
          Bodega destino <span className="text-red-500">*</span>
        </label>
        <Controller
          name="destWarehouseId"
          control={control}
          render={({ field }) => (
            <select
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
              className="input-hard w-full px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
            >
              <option value="">Selecciona bodega destino</option>
              {warehouses
                .filter((w: Warehouse) => w.id !== warehouseId)
                .map((w: Warehouse) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          )}
        />
      </div>

      {/* Cascada zona + bulto cuando el destino es una bodega física */}
      {destRequiresBin && (
        <>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-secondary">
              Zona destino <span className="text-red-500">*</span>
            </label>
            {isLoadingDestDetail ? (
              <div className="h-9 rounded-lg bg-surface-hover animate-pulse" />
            ) : (
              <select
                value={selectedZoneId}
                onChange={(e) => {
                  setSelectedZoneId(e.target.value)
                  setValue('destBinId', undefined)
                }}
                className="input-hard w-full px-3 py-2 text-sm border-ui-border-medium text-content transition-all"
              >
                <option value="">Selecciona una zona</option>
                {destZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-secondary">
              Bulto destino <span className="text-red-500">*</span>
            </label>
            <Controller
              name="destBinId"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  disabled={!selectedZoneId}
                  className={cn(
                    'input-hard w-full px-3 py-2 text-sm text-content transition-all',

                    !selectedZoneId && 'opacity-50 cursor-not-allowed',
                    'border-ui-border-medium',
                  )}
                >
                  <option value="">Selecciona un bulto</option>
                  {destBins.map((b) => (
                    <option key={b.id} value={b.id}>
                      Bulto {b.code}
                      {b.occupied ? ' (ocupado — ya asignado a este borrador)' : ''}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </>
      )}
    </>
  )
}
