import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { getWarehouses, getWarehouse } from '@/services/warehouses.service'
import type { Warehouse, WarehouseDetail } from '@/types/warehouse.types'
import type { FormValues } from '../document-form.schema'

export function useTransferLocations(
  docType: FormValues['type'],
  watch: UseFormWatch<FormValues>,
  setValue: UseFormSetValue<FormValues>,
) {
  const warehouseId = watch('warehouseId')
  const destWarehouseId = watch('destWarehouseId')

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
    staleTime: 10 * 60 * 1000,
  })

  // Carga el detalle de la bodega origen para la cascada zona/bulto (solo en traslados).
  const { data: sourceWarehouseDetail, isLoading: isLoadingSourceDetail } = useQuery({
    queryKey: ['warehouses', warehouseId],
    queryFn: () => getWarehouse(warehouseId!),
    enabled: docType === 'T' && Boolean(warehouseId),
    staleTime: 5 * 60 * 1000,
  })

  // Carga el detalle de la bodega destino para la cascada zona/bulto (solo en traslados).
  const { data: destWarehouseDetail, isLoading: isLoadingDestDetail } = useQuery({
    queryKey: ['warehouses', destWarehouseId],
    queryFn: () => getWarehouse(destWarehouseId!),
    enabled: docType === 'T' && Boolean(destWarehouseId),
    staleTime: 5 * 60 * 1000,
  })

  // Cada bulto pertenece a una bodega concreta. Si cambia la bodega origen, el bulto ya
  // elegido casi seguro deja de ser válido, así que se limpia junto con la zona.
  useEffect(() => {
    setValue('sourceBinId', undefined)
  }, [warehouseId, setValue])

  // Mismo motivo que el efecto anterior, pero para la bodega destino.
  useEffect(() => {
    setValue('destBinId', undefined)
  }, [destWarehouseId, setValue])

  // Si el origen cambia DESPUÉS de elegir destino, el destino queda apuntando a una opción oculta y arrastra zona/bulto fantasma; se limpia.
  useEffect(() => {
    if (destWarehouseId && destWarehouseId === warehouseId) {
      setValue('destWarehouseId', undefined)
    }
  }, [warehouseId, destWarehouseId, setValue])

  // Solo las bodegas físicas llevan seguimiento por bulto; los almacenes de venta no tienen
  // ese detalle, así que el traslado no pide zona ni bulto cuando el origen es un almacén.
  const sourceRequiresBin =
    docType === 'T' &&
    Boolean(warehouseId) &&
    warehouses.find((w: Warehouse) => w.id === warehouseId)?.type === 'warehouse'

  // Mismo criterio, aplicado a la bodega destino.
  const destRequiresBin =
    docType === 'T' &&
    Boolean(destWarehouseId) &&
    warehouses.find((w: Warehouse) => w.id === destWarehouseId)?.type === 'warehouse'

  const sourceZones = (sourceWarehouseDetail as WarehouseDetail | undefined)?.zones ?? []
  const destZones = (destWarehouseDetail as WarehouseDetail | undefined)?.zones ?? []

  const [selectedSourceZoneId, setSelectedSourceZoneId] = useState('')
  useEffect(() => {
    setSelectedSourceZoneId('')
  }, [warehouseId])

  const [selectedZoneId, setSelectedZoneId] = useState('')
  useEffect(() => {
    setSelectedZoneId('')
  }, [destWarehouseId])

  const currentSourceBinId = watch('sourceBinId')
  const currentDestBinId = watch('destBinId')

  // Al abrir un borrador llega el bulto pero no la zona: se deduce una sola vez por bulto, sin pisar lo que el usuario cambie después.
  const inferredSourceBinId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (selectedSourceZoneId || !currentSourceBinId) return
    if (inferredSourceBinId.current === currentSourceBinId) return
    const zone = sourceZones.find((z) => z.bins.some((b) => b.id === currentSourceBinId))
    if (!zone) return
    inferredSourceBinId.current = currentSourceBinId
    setSelectedSourceZoneId(zone.id)
  }, [selectedSourceZoneId, currentSourceBinId, sourceZones])

  const inferredDestBinId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (selectedZoneId || !currentDestBinId) return
    if (inferredDestBinId.current === currentDestBinId) return
    const zone = destZones.find((z) => z.bins.some((b) => b.id === currentDestBinId))
    if (!zone) return
    inferredDestBinId.current = currentDestBinId
    setSelectedZoneId(zone.id)
  }, [selectedZoneId, currentDestBinId, destZones])

  // Productos actualmente en el documento — un bulto origen solo califica si ya tiene stock
  // de alguno de estos productos (normalmente se traslada un solo producto por bulto).
  const watchedItems = watch('items')
  const itemProductIds = new Set(
    (watchedItems ?? []).map((item) => item.productId).filter((pid): pid is string => Boolean(pid)),
  )

  const sourceBins = (() => {
    const baseBins = selectedSourceZoneId
      ? (sourceZones.find((z) => z.id === selectedSourceZoneId)?.bins ?? [])
      : sourceZones.flatMap((z) => z.bins)

    const available = baseBins.filter((bin) =>
      bin.binStocks.some((bs) => bs.quantity > 0 && itemProductIds.has(bs.productId)),
    )

    // El bulto ya elegido se reinserta aunque ya no pase el filtro, para no dejar el selector apuntando a una opción inexistente.
    if (currentSourceBinId && !available.some((b) => b.id === currentSourceBinId)) {
      const staleSelected = baseBins.find((b) => b.id === currentSourceBinId)
      if (staleSelected) return [...available, staleSelected]
    }

    return available
  })()

  const destBins = (() => {
    const baseBins = selectedZoneId
      ? (destZones.find((z) => z.id === selectedZoneId)?.bins ?? [])
      : destZones.flatMap((z) => z.bins)

    // "occupied" lo calcula el backend (stock > 0); un bulto ocupado se filtra salvo que solo tenga productos ya presentes en este documento (apilar, no mezclar). Filtro solo visual, el backend valida de verdad.
    const available = baseBins.filter(
      (bin) => !bin.occupied || bin.binStocks.every((bs) => itemProductIds.has(bs.productId)),
    )

    // Mismo motivo que en los bultos de origen: mantener visible el bulto ya elegido aunque
    // ya no pase el filtro, para no dejar el selector apuntando a una opción inexistente.
    if (currentDestBinId && !available.some((b) => b.id === currentDestBinId)) {
      const staleSelected = baseBins.find((b) => b.id === currentDestBinId)
      if (staleSelected) return [...available, staleSelected]
    }

    return available
  })()

  return {
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
  }
}

export type TransferLocations = ReturnType<typeof useTransferLocations>
