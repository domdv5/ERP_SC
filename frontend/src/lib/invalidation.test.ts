import { describe, it, expect, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { invalidateAfterDocumentChange } from './invalidation'

function collectInvalidatedKeys(run: (qc: QueryClient) => void) {
  const invalidateQueries = vi.fn()
  run({ invalidateQueries } as unknown as QueryClient)
  const keys: unknown[][] = []
  const prefixes: string[] = []
  for (const [filters] of invalidateQueries.mock.calls) {
    if (filters.queryKey) keys.push(filters.queryKey)
    if (filters.predicate) {
      for (const probe of ['third-parties', 'products']) {
        if (filters.predicate({ queryKey: [probe, 'x'] })) prefixes.push(probe)
      }
    }
  }
  return { keys, prefixes }
}

describe('invalidateAfterDocumentChange', () => {
  it('invalida la lista de terceros (columna Cupo)', () => {
    const { prefixes } = collectInvalidatedKeys((qc) => invalidateAfterDocumentChange(qc))
    expect(prefixes).toContain('third-parties')
  })

  it('sigue invalidando documentos y cartera', () => {
    const { keys } = collectInvalidatedKeys((qc) => invalidateAfterDocumentChange(qc, ['d1']))
    expect(keys).toContainEqual(['documents'])
    expect(keys).toContainEqual(['accounts-receivable'])
    expect(keys).toContainEqual(['document', 'd1'])
  })
})
