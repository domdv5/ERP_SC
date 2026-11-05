import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { getInventoryCase } from '@/services/inventory-cases.service'
import { ErrorState } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { formatBogotaDate } from '@/lib/format'
import { formatDaysSince } from '@/lib/utils'
import type { InventoryCaseDetail } from '@/types/inventory-case.types'
import { CaseMovementsTable } from './components/CaseMovementsTable'
import { CaseStatusPill } from './components/CaseStatusPill'
import { CloseCasePanel } from './components/CloseCasePanel'
import { ClosedCaseSummary } from './components/ClosedCaseSummary'
import { DocumentLink } from './components/DocumentLink'
import { formatSignedQuantity } from './inventory-cases.constants'

const formatDateTime = (iso: string) =>
  `${formatBogotaDate(iso)} · ${new Date(iso).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })}`

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] uppercase tracking-wider text-content-muted">{label}</p>
      <div className="text-sm text-content font-medium">{children}</div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-4 w-48 rounded bg-surface-hover" />
      <div className="card-hard h-40 bg-surface-hover" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card-hard h-96 bg-surface-hover" />
        <div className="card-hard h-96 bg-surface-hover" />
      </div>
    </div>
  )
}

// undefined = el usuario aún no eligió y rige la sugerencia; null = eligió "sin documento".
function CaseDetailBody({ inventoryCase }: { inventoryCase: InventoryCaseDetail }) {
  const canClose = usePermission('inventory_case.close')
  const [chosenOriginId, setChosenOriginId] = useState<string | null | undefined>(undefined)

  const isOpen = inventoryCase.status === 'open'
  const originId =
    chosenOriginId === undefined
      ? isOpen
        ? inventoryCase.suggestedOriginDocumentId
        : (inventoryCase.originDocument?.id ?? null)
      : chosenOriginId
  const originDocument =
    inventoryCase.movements.find((movement) => movement.document?.id === originId)?.document ?? null
  const canChooseOrigin = isOpen && canClose

  const { product, warehouse, adjustedBy, adjustmentDocument, notes } = inventoryCase

  return (
    <>
      <section className="card-hard p-5 space-y-4" aria-labelledby="case-title">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="flex-1 min-w-[260px] space-y-1.5">
            <div className="flex items-center gap-2">
              <CaseStatusPill status={inventoryCase.status} />
              <span className="font-mono text-xs text-content-muted">{inventoryCase.number}</span>
              {isOpen && (
                <span className="text-xs text-content-muted font-accent">
                  {formatDaysSince(inventoryCase.daysOpen)}
                </span>
              )}
            </div>
            <h1 id="case-title" className="text-2xl text-content">
              {product.code} {product.description}
            </h1>
            <p className="text-sm text-content-muted font-accent">{product.brandName}</p>
          </div>

          <Fact label="Bodega">{warehouse.name}</Fact>
          <Fact label="Ajuste">
            <span className="font-display font-black text-2xl">
              {formatSignedQuantity(inventoryCase.quantity)}
            </span>
            <span className="block text-xs text-content-muted font-normal">
              Stock {inventoryCase.stockBefore} → {inventoryCase.stockAfter}
            </span>
          </Fact>
          <Fact label="Documento">
            <DocumentLink document={adjustmentDocument} />
            <span className="block text-xs text-content-muted font-normal">Motivo: negativo</span>
          </Fact>
          <Fact label="Ajustó">
            {adjustedBy.name}
            <span className="block text-xs text-content-muted font-normal">
              {formatDateTime(inventoryCase.createdAt)}
            </span>
          </Fact>
        </div>

        {notes && (
          <p className="border-t-2 border-ui-border pt-3 text-sm text-content-secondary">
            <b className="text-content">Notas de la EAI</b>{' '}
            <span className="text-content-muted">
              (escritas por {adjustedBy.name} al hacer el ajuste):
            </span>{' '}
            <span className="whitespace-pre-wrap">«{notes}»</span>
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <section className="card-hard overflow-hidden" aria-labelledby="timeline-title">
          <div className="px-5 py-4 border-b-2 border-ui-border-medium">
            <h2 id="timeline-title" className="text-lg text-content">
              Lo que pasó antes del ajuste
            </h2>
            <p className="text-xs text-content-muted font-accent mt-0.5">
              Movimientos de {product.code} en {warehouse.name} · del más antiguo al más reciente
            </p>
          </div>
          <CaseMovementsTable
            movements={inventoryCase.movements}
            adjustmentDocumentId={adjustmentDocument.id}
            suggestedOriginDocumentId={inventoryCase.suggestedOriginDocumentId}
            selectedOriginId={originId}
            onSelectOrigin={canChooseOrigin ? setChosenOriginId : undefined}
          />
        </section>

        <aside aria-label="Acciones del caso">
          {!isOpen && <ClosedCaseSummary inventoryCase={inventoryCase} />}
          {isOpen && canClose && (
            <CloseCasePanel
              caseId={inventoryCase.id}
              originDocument={originDocument}
              onClearOrigin={() => setChosenOriginId(null)}
            />
          )}
          {isOpen && !canClose && (
            <p className="card-hard p-5 text-sm text-content-muted">
              Este caso está abierto. Solo quien tiene permiso para cerrar casos puede resolverlo.
            </p>
          )}
        </aside>
      </div>
    </>
  )
}

export default function InventoryCaseDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory-cases', 'detail', id],
    queryFn: () => getInventoryCase(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-4">
      <nav aria-label="Ruta" className="flex items-center gap-2 text-sm text-content-muted">
        <Link
          to="/inventory-cases"
          className="flex items-center gap-2 hover:text-content transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Diferencias de inventario
        </Link>
        {data && (
          <>
            <span aria-hidden="true">/</span>
            <span className="text-content">Caso {data.number}</span>
          </>
        )}
      </nav>

      {isLoading && <DetailSkeleton />}

      {isError && (
        <div className="card-hard">
          <ErrorState message="Error al cargar el caso" onRetry={refetch} />
        </div>
      )}

      {data && (
        <CaseDetailBody key={`${data.id}:${data.status}:${data.reopenedAt}`} inventoryCase={data} />
      )}

      {!isLoading && !isError && !data && (
        <div className="card-hard p-8 text-center text-content-muted">
          <ClipboardList className="w-10 h-10 mx-auto mb-2" aria-hidden="true" />
          Caso no encontrado
        </div>
      )}
    </div>
  )
}
