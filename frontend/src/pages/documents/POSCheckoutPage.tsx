import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { CalendarDays, User, UserCog } from 'lucide-react'

import { Combobox, SegmentedToggle, CreditsPanel, CustomerBranchSelect } from '@/components/shared'
import { cn } from '@/lib/utils'
import { docNumber, todayInBogota } from '@/lib/format'
import type { FormValues } from './document-form.schema'
import { MissingStockDialog } from './components/MissingStockDialog'
import { CreditLimitPanel, CreditLimitErrorPanel } from './pos-checkout/CreditLimitPanels'
import { PaymentLinesField } from './pos-checkout/PaymentLinesField'
import { PendingConversionNotice } from './pos-checkout/PendingConversionNotice'
import { SaleCart } from './pos-checkout/SaleCart'
import { SaleHeader } from './pos-checkout/SaleHeader'
import { SaleSummary } from './pos-checkout/SaleSummary'
import { findMissingItems } from './pos-checkout/findMissingItems'
import { useAppliedCredits } from './pos-checkout/useAppliedCredits'
import { useCartProducts } from './pos-checkout/useCartProducts'
import { useConfirmSale } from './pos-checkout/useConfirmSale'
import { useCreditLimit } from './pos-checkout/useCreditLimit'
import { usePaymentLines } from './pos-checkout/usePaymentLines'
import { useSaleDraft } from './pos-checkout/useSaleDraft'
import { useSaleMode } from './pos-checkout/useSaleMode'
import { useSaleParties } from './pos-checkout/useSaleParties'
import { useSaleTotals } from './pos-checkout/useSaleTotals'

export default function POSCheckoutPage() {
  const navigate = useNavigate()

  // Reusa el form genérico solo para el input de escaneo; el resto de sus campos no se usan, la venta se arma aparte.
  const form = useForm<FormValues>({
    defaultValues: { type: 'PV', date: todayInBogota(), items: [] },
  })
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  })
  const cartItems = form.watch('items')

  const parties = useSaleParties()
  const { thirdPartyId, sellerId } = parties
  const {
    canCreateCOT,
    canCreatePOSO,
    mode,
    setMode,
    official,
    setOfficial,
    isCredit,
    docType,
    accent,
  } = useSaleMode()

  const { creditData, isLoadingCredit, creditError, clearCreditError, handleCreditError } =
    useCreditLimit(mode, isCredit, thirdPartyId)

  const { productDetailByCode, minSalePriceByProductId, priceFloorViolations } =
    useCartProducts(cartItems)
  const { total, hasValidItems, totalUnits, officialTotals, grandTotal } = useSaleTotals(
    cartItems,
    fields.length,
    official,
  )
  const credits = useAppliedCredits({ thirdPartyId, official, total, grandTotal })
  const { creditsApplied, totalToPay } = credits
  const payments = usePaymentLines(totalToPay)

  const draft = useSaleDraft({
    mode,
    official,
    setMode,
    setOfficial,
    parties,
    replaceItems: replace,
    setPaymentRows: payments.setPaymentRows,
    handleCreditError,
  })
  const { draftId, sourceDocument, pendingPreventa } = draft

  // Si el saldo a favor cubre toda la venta no hay nada que cobrar: no se piden formas de pago.
  const needsPayments = !isCredit && totalToPay > 0
  // Bloqueo duro sobre el neto (total menos saldos a favor); no hay override, se sube el cupo desde la ficha del cliente.
  const creditExceeded =
    isCredit && Boolean(creditData) && total - creditsApplied > creditData!.availableCredit

  const missingItems = findMissingItems({
    thirdPartyId,
    isLoadingBranches: parties.isLoadingBranches,
    needsBranch: parties.needsBranch,
    customerBranchId: parties.customerBranchId,
    sellerId,
    needsPayments,
    paymentLines: payments.paymentLines,
    totalToPay,
    hasValidItems,
    hasPriceFloorViolations: priceFloorViolations.length > 0,
    isCredit,
    isLoadingCredit,
    creditExceeded,
  })
  const canConfirm = missingItems.length === 0

  const { handleConfirm, isSubmitting, missingStock, setMissingStock } = useConfirmSale({
    canConfirm,
    docType,
    official,
    isCredit,
    draftId,
    setDraftId: draft.setDraftId,
    setDraftNumber: draft.setDraftNumber,
    thirdPartyId,
    customerBranchId: parties.customerBranchId,
    needsBranch: parties.needsBranch,
    sellerId,
    needsPayments,
    paymentLines: payments.paymentLines,
    cartItems,
    selectedCredits: credits.selectedCredits,
    clearCreditError,
    handleCreditError,
  })

  if (draft.resumeDraftId && !draftId) {
    return <div className="h-64 rounded-2xl bg-surface-raised animate-pulse" />
  }

  return (
    <div className="space-y-6 pb-10">
      <SaleHeader
        docType={docType}
        official={official}
        isCredit={isCredit}
        draftId={draftId}
        draftNumber={draft.draftNumber}
        sourceDocument={sourceDocument}
        onBack={() => navigate('/documents')}
      />

      {draftId && (
        <p className="text-content-muted text-sm font-accent">
          El tipo de venta se elige antes de convertir o guardar. Para cambiarlo, elimina el
          borrador.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Columna principal ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de la venta */}
          <div className={cn('card-hard p-6 space-y-5 border-l-[6px]', accent.border)}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-divide pb-3">
              <h2 className="text-base text-content">Datos de la venta</h2>
              <div className="flex flex-wrap items-center gap-3">
                {canCreatePOSO && (
                  <SegmentedToggle
                    checked={official}
                    disabled={Boolean(draftId)}
                    onChange={(checked) => {
                      if (draftId || sourceDocument) return
                      setOfficial(checked)
                      if (checked) {
                        setMode('POS')
                        draft.setPendingPreventa(null)
                      } else if (thirdPartyId) {
                        // El cliente pudo elegirse en modo oficial, donde no se buscó su preventa activa.
                        void draft.checkPendingPreventa(thirdPartyId)
                      }
                    }}
                    uncheckedLabel="Normal"
                    checkedLabel="Oficial"
                  />
                )}
                {canCreateCOT && !official && (
                  <SegmentedToggle
                    checked={isCredit}
                    disabled={Boolean(draftId)}
                    onChange={(checked) => {
                      if (!draftId) setMode(checked ? 'COT' : 'POS')
                    }}
                    uncheckedLabel="Contado"
                    checkedLabel="Crédito"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <User className="w-3.5 h-3.5" />
                  Cliente <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={thirdPartyId}
                  onChange={(id, option) => {
                    void draft.handleCustomerSelected(id, option.label)
                  }}
                  options={parties.tpDisplayOptions}
                  isLoading={parties.isLoadingTp}
                  placeholder="Selecciona un cliente..."
                  searchValue={parties.tpSearch}
                  onSearchChange={parties.setTpSearch}
                />
                {draft.checkingPreventa && (
                  <p className="text-xs text-content-faint font-accent">
                    Buscando preventas activas...
                  </p>
                )}
                {thirdPartyId && (
                  <CustomerBranchSelect
                    branches={parties.customerBranches}
                    value={parties.customerBranchId}
                    onChange={parties.setCustomerBranchId}
                    isLoading={parties.isLoadingBranches}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <UserCog className="w-3.5 h-3.5" />
                  Vendedora <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={sellerId}
                  onChange={(id, option) => parties.selectSeller(id, option.label)}
                  options={parties.sellerDisplayOptions}
                  isLoading={parties.isLoadingSeller}
                  placeholder="Selecciona una vendedora..."
                  searchValue={parties.sellerSearch}
                  onSearchChange={parties.setSellerSearch}
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Fecha
                </label>
                <input
                  type="date"
                  value={todayInBogota()}
                  readOnly
                  className="input-hard w-full px-3 py-2 text-sm text-content border-ui-border-medium opacity-60 cursor-not-allowed"
                />
              </div>

              {/* Formas de pago — solo venta de contado con algo por cobrar. */}
              {needsPayments && (
                <PaymentLinesField
                  paymentLines={payments.paymentLines}
                  paymentDifference={payments.paymentDifference}
                  onMethodChange={(index, method) => payments.updatePaymentRow(index, { method })}
                  onAmountChange={payments.changePaymentAmount}
                  onAdd={payments.addPaymentRow}
                  onRemove={payments.removePaymentRow}
                />
              )}
            </div>

            {isCredit && thirdPartyId && (
              <CreditLimitPanel
                creditData={creditData}
                isLoading={isLoadingCredit}
                creditExceeded={creditExceeded}
                netAmount={total - creditsApplied}
              />
            )}

            {creditError && (
              <CreditLimitErrorPanel message={creditError.message} detail={creditError.detail} />
            )}

            {/* Saldo a favor del cliente aplicable a esta venta. */}
            {!official && (
              <CreditsPanel
                title="Saldo a favor del cliente"
                credits={credits.availableCredits.map((c) => ({
                  id: c.id,
                  balance: c.balance,
                  label: docNumber(c.sourceDocument.type, c.sourceDocument.number),
                }))}
                creditAmounts={credits.creditAmounts}
                setCreditAmount={credits.setCreditAmount}
                creditsApplied={creditsApplied}
                totalAvailable={credits.totalAvailable}
              />
            )}
          </div>

          {pendingPreventa && !official && (
            <PendingConversionNotice
              document={pendingPreventa}
              isCredit={isCredit}
              cartItemCount={fields.length}
              isConverting={draft.isConverting}
              onConvert={() => draft.doConvert(pendingPreventa.id)}
              onDismiss={() => draft.setPendingPreventa(null)}
            />
          )}

          <SaleCart
            docType={docType}
            official={official}
            form={form}
            fields={fields}
            append={append}
            remove={remove}
            cartItems={cartItems}
            productDetailByCode={productDetailByCode}
            minSalePriceByProductId={minSalePriceByProductId}
          />
        </div>

        <SaleSummary
          official={official}
          isCredit={isCredit}
          total={total}
          creditsApplied={creditsApplied}
          totalToPay={totalToPay}
          officialTotals={officialTotals}
          itemCount={fields.length}
          totalUnits={totalUnits}
          missingItems={missingItems}
          canConfirm={canConfirm}
          isSubmitting={isSubmitting}
          onConfirm={() => {
            void handleConfirm()
          }}
          onCancel={() => navigate('/documents')}
        />
      </div>

      {missingStock && (
        <MissingStockDialog missingStock={missingStock} onClose={() => setMissingStock(null)} />
      )}
    </div>
  )
}
