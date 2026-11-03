// Fila de lecturas del lector: se procesan una a una y en orden, ninguna se descarta
export function createScanQueue(
  process: (code: string) => Promise<void>,
  onPendingChange?: (pending: number) => void,
) {
  let tail: Promise<void> = Promise.resolve()
  let pending = 0

  const enqueue = (code: string) => {
    pending += 1
    onPendingChange?.(pending)
    tail = tail
      .then(() => process(code))
      .catch(() => {})
      .finally(() => {
        pending -= 1
        onPendingChange?.(pending)
      })
  }

  return { enqueue, idle: () => tail }
}

export function findRowIndexByCode(rows: { productCode?: string }[], code: string) {
  const wanted = code.trim().toLowerCase()
  return rows.findIndex((row) => row.productCode?.toLowerCase() === wanted)
}
