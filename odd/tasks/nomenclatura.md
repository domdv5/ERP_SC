# Nomenclatura en inglés simple

## Objective
Renombrar funciones con nombres engañosos, rebuscados o ambiguos para que se entiendan sin traducir; dejar la regla escrita para el código nuevo.

## Decisions (usuario, 2026-10-09)
- Código en inglés simple, comentarios en español. Regla en CLAUDE.md raíz (Naming Conventions).
- 3 PRs: (1) backend interno, (2) vocabulario crédito/saldo a favor, (3) findShortfalls (contrato) + auditoría y renombres del frontend.

## Tasks
- [x] T1 — Regla Naming Conventions en CLAUDE.md. Route: inline.
- [x] T2 — PR 1 backend interno: assertBatchAvailability→calculateMissingStock, officialNetFloor→getOfficialMinNetPrice (solo backend), openingAggregate→sumMovementsBeforeDate, computeReversedAvgCost→calculateAvgCostAfterVoid, resolveLastCostAfterVoidingCm→findLastPurchaseCostAfterVoid, requestMatchesExisting→isSameEgresoRequest, generate→generatePdf, round2→roundTo2Decimals, statement→getSupplierStatement. Route: delegated (nestjs-code-crafter).
- [x] T3 — PR 2 vocabulario crédito, alcance chico (usuario): "credit" = saldo a favor (nombre del modelo Prisma), cupo siempre `creditLimit`; verbos unificados. Sin migración ni cambios de API.
- [ ] T4 — PR 3: findShortfalls/StockShortfall/AvailabilityShortfall + ruta/campo JSON + auditoría de nombres del frontend y renombres.

## Delivery
Una rama y un PR por tanda; merge tras CI verde y main local actualizado.

## Progress / Evidence
- T2: PR #15 mergeado (4aeb49a). 9 renombres, jest 110/110, tsc OK. Revisión RDD rechazada por el usuario para ese candidato.
- T3: getCustomerCredit→getCreditLimit, getCustomerCreditSummary→getCreditLimitSummary (service + helper), get/listAvailableCustomerCredits→findAvailableCustomerCredits, findAvailableCredits→findAvailableSupplierCredits (+DTO), revertCustomerCreditApplications→undoCustomerCreditApplications. jest 110/110, tsc OK.
