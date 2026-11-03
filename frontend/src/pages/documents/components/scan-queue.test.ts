import { describe, expect, it } from 'vitest'
import { createScanQueue, findRowIndexByCode } from './scan-queue'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Simula el documento: buscar en el servidor tarda y cada lectura suma o agrega fila.
function fakeDocument() {
  const rows: { productCode: string; quantity: number }[] = []
  let serverCalls = 0
  const process = async (code: string) => {
    const index = findRowIndexByCode(rows, code)
    if (index >= 0) {
      rows[index].quantity += 1
      return
    }
    serverCalls += 1
    await wait(20)
    rows.push({ productCode: code.toUpperCase(), quantity: 1 })
  }
  return { rows, process, serverCalls: () => serverCalls }
}

describe('createScanQueue', () => {
  it('5 lecturas rápidas del mismo código dan cantidad 5', async () => {
    const doc = fakeDocument()
    const queue = createScanQueue(doc.process)
    for (let i = 0; i < 5; i++) queue.enqueue('abc1')
    await queue.idle()
    expect(doc.rows).toEqual([{ productCode: 'ABC1', quantity: 5 }])
    expect(doc.serverCalls()).toBe(1)
  })

  it('A, A, B, A se procesa en orden: A=3 y B=1', async () => {
    const doc = fakeDocument()
    const queue = createScanQueue(doc.process)
    for (const code of ['A', 'A', 'B', 'A']) queue.enqueue(code)
    await queue.idle()
    expect(doc.rows).toEqual([
      { productCode: 'A', quantity: 3 },
      { productCode: 'B', quantity: 1 },
    ])
  })

  it('una lectura que falla no frena las siguientes', async () => {
    const processed: string[] = []
    const queue = createScanQueue(async (code) => {
      if (code === 'MALO') throw new Error('no existe')
      processed.push(code)
    })
    for (const code of ['A', 'MALO', 'B']) queue.enqueue(code)
    await queue.idle()
    expect(processed).toEqual(['A', 'B'])
  })

  it('avisa cuántas lecturas quedan pendientes y termina en 0', async () => {
    const doc = fakeDocument()
    const counts: number[] = []
    const queue = createScanQueue(doc.process, (pending) => counts.push(pending))
    queue.enqueue('A')
    queue.enqueue('A')
    await queue.idle()
    expect(counts).toEqual([1, 2, 1, 0])
  })
})

describe('findRowIndexByCode', () => {
  it('ignora mayúsculas y espacios', () => {
    expect(findRowIndexByCode([{ productCode: 'X1' }, { productCode: 'Ab-2' }], ' ab-2 ')).toBe(1)
    expect(findRowIndexByCode([{ productCode: 'X1' }], 'X2')).toBe(-1)
  })
})
