---
name: project-supplier-credit-frontend
description: Plan 020 Step 8 (frontend) implemented — SupplierCredit application UI in RegisterPaymentForm/AccountsPayableDetailPage, coupled to a backend built in parallel
metadata:
  type: project
---

Implemented 2026-07-27: frontend side of plan `plans/020-supplier-credit-application.md`, Paso 8. Backend (SupplierCredit model, migration, DvcEffectStrategy, registerPayment extension, GET /accounts-payable/credits) was being built by a different agent **in parallel** and had not landed yet when the frontend work was done — verified by grepping `backend/src/accounts-payable/*` and finding no `credits`/`SupplierCredit`/`creditApplications` references at the time.

Frontend changes made against the plan's fixed contract (not the live backend code):
- `frontend/src/types/accounts-payable.types.ts` — added `SupplierCredit`, `SupplierCreditApplication`, `CreditApplicationPayload`; `AccountsPayableDetail.creditApplications` is **optional** (`creditApplications?: SupplierCreditApplication[]`) specifically to degrade gracefully if the backend detail endpoint doesn't include it yet.
- `frontend/src/services/accounts-payable.service.ts` — `getSupplierCredits(supplierId)` hits `GET /accounts-payable/credits?supplierId=`.
- `frontend/src/pages/accounts-payable/components/RegisterPaymentForm.tsx` — new `supplierId` prop; queries available credits (`staleTime: 5*60*1000`, `enabled: open && Boolean(supplierId)`); renders a per-credit numeric input list (`useFieldArray`) under "Aplicar saldo a favor", not a `Combobox` — deliberate choice since the business needs partial amounts applied across *multiple* credits simultaneously, which a single-select combobox can't express. Zod schema uses `superRefine` (wrapped in `useMemo` keyed on `pendingBalance`, matching the pre-existing pattern) to validate `efectivo + Σcréditos > 0`, `<= pendingBalance`, and each row `<= its own balance`. `amount` (efectivo) relaxed from `.positive()` to `.min(0)`. `paymentMethod` stays required even for a credit-only (efectivo=0) payment — the backend DTO (plan Paso 5) does NOT make it nullable, so this is a real, permanent contract wart, not a bug to fix.
- Submit handler strips the client-only `balance` field and filters zero-amount rows before sending `creditApplications` to the backend (backend's `CreditApplicationDto.amount` is `@IsPositive()`, and the global `ValidationPipe` has `forbidNonWhitelisted: true` — an extra `balance` key or a zero-amount row would 400).
- `frontend/src/pages/accounts-payable/AccountsPayableDetailPage.tsx` — merges `payablePayments` + `creditApplications` into one sorted `settlementRows` list for the "Historial de pagos" table; credit rows get an amber "Nota crédito aplicada" badge in the Método column. **Important**: `pendingBalance` calculation now sums both `payablePayments` and `creditApplications` — if the backend's `findOne` doesn't actually include `creditApplications` in its Prisma `include`, pendingBalance will silently read too high (cash-only) after a credit is applied. This must be re-verified once the backend lands.

**Assumed Option B** (separate `SupplierCreditApplication` table, per the plan's default) — not Option A (discriminator column on `PayablePayment`). If the backend agent went with Option A instead, the type shape and the settlementRows merge in `AccountsPayableDetailPage.tsx` need to be revisited (would key off a `source` field on `PayablePayment` instead of a separate array).

See also [[feedback-zod-v4]] for why `superRefine` + `coerce` fields need `as never`/`as any` casts on the resolver and `handleSubmit`.
