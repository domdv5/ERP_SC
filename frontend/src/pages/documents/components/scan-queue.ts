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

// onlyLastRow: solo cuenta la última fila (tipos que separan filas, ver row-grouping.ts)
export function findRowIndexByCode(
  rows: { productCode?: string }[],
  code: string,
  onlyLastRow = false,
) {
  const wanted = code.trim().toLowerCase()
  const matches = (row: { productCode?: string }) => row.productCode?.toLowerCase() === wanted
  if (!onlyLastRow) return rows.findIndex(matches)
  return rows.length > 0 && matches(rows[rows.length - 1]) ? rows.length - 1 : -1
}
