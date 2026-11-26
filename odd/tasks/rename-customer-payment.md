# Renombrar recibo de caja → customer_payment (PR 2 de 2)

Mismo patrón que `odd/tasks/rename-supplier-payment.md` (PR #118, mergeado): nombres técnicos del recibo de caja en inglés; lo que ve el usuario sigue en español.

## Specs

- S1 — Mapa de nombres aprobado por el dueño ("dale", 2026-11-26):
  - Tablas: `recibo_caja` → `customer_payment`; `recibo_caja_payment` → `customer_payment_method`; `recibo_caja_allocation` → `customer_payment_allocation`; columna `recibo_caja_id` → `customer_payment_id` (en `customer_payment_method`, `customer_payment_allocation` y `customer_credit_application`).
  - Modelos Prisma: `ReciboCaja` → `CustomerPayment`; `ReciboCajaPayment` → `CustomerPaymentMethod`; `ReciboCajaAllocation` → `CustomerPaymentAllocation`.
  - Enums: `ReciboCajaVoidReason` → `CustomerPaymentVoidReason`; `ReciboCajaDiscountReason` → `CustomerPaymentDiscountReason`. Los VALORES no cambian. `TreasuryPaymentMethod` ya existe y no cambia.
  - Carpetas: `backend/src/recibos-caja/` → `backend/src/customer-payments/`; `frontend/src/pages/recibos-caja/` → `frontend/src/pages/customer-payments/`.
  - Archivos y clases: `recibos-caja.service.ts` → `customer-payments.service.ts` (`CustomerPaymentsService`), igual controller/module/DTOs (`create-customer-payment.dto.ts`, `void-customer-payment.dto.ts`, `find-all-customer-payments.dto.ts`, `find-open-items.dto.ts` se queda); pantallas `CustomerPaymentDetailPage`, `CustomerPaymentNewPage`, `CustomerPaymentsListPage`, `VoidCustomerPaymentDialog`, etc.
  - Contrato: `backend/src/contracts/recibos-caja.ts` → `backend/src/contracts/customer-payments.ts`; tipos `ReciboCaja*` → `CustomerPayment*`; campos JSON `reciboCajaId` → `customerPaymentId`, `reciboCaja` → `customerPayment`; valores discriminantes `'recibo_caja'`/`'recibo'` (si existen en contratos de CxC/créditos) → `'customer_payment'`.
  - Rutas: API `/recibos-caja` → `/customer-payments`; navegador `/recibos-caja` → `/customer-payments`.
  - Permisos: `recibo.create/read/void` → `customer_payment.create/read/void`.
- S2 — No cambia: textos en pantalla ("Recibos de caja", "Nuevo recibo"…), valores de enums, la clave de `Sequence` del recibo (dato), comentarios de tablas, variables de otros conceptos. Sin redirecciones de rutas viejas (caen en la 404).
- S3 — La migración solo renombra (`ALTER ... RENAME`) más `UPDATE permission.code`; nunca borra ni copia datos; después `prisma migrate diff` contra la base no muestra cambios (salvo los 2 índices trigram aceptados). Respaldo previo: `erp_db_pre_customer_payment.dump`.
- S4 — Docs: `backend/CLAUDE.md` y `frontend/CLAUDE.md` apuntan a los nombres nuevos.
- S5 — Sin cambio de comportamiento: jest y vitest completos pasan; `tsc` backend y build frontend sin errores.

## Tasks

- T1 [S1,S3,S4,S5] schema + migración + backend + seed RBAC + contrato + backend/CLAUDE.md — nestjs-code-crafter — commit: 8b2b098
- T2 [S1,S2,S4,S5] frontend + frontend/CLAUDE.md — react-code-crafter — commit: 8b2b098
- T3 [S5] verificación completa, PR — parent — commit: 8b2b098

## Log

- L1 (dueño, 2026-11-26): "antes de esto, hay algo que quiero hacer primero es que tanto en la bd como el nombre de las carpetas del proyecto está en spanglish y la verdad no me gusta puedes explorar y decirme cuáles son y proponer un plan para cambiarlo"
- L2 (dueño): "dale" al mapa `supplier_payment` / `customer_payment`; "1" = mergear primero el PR 1 y después hacer este.
- L3: objetos actuales en la base (verificados): 17 constraints, 14 índices, 2 enums, 3 columnas `recibo_caja_id`, CHECK `customer_credit_application_target_chk` (usa la columna; el RENAME de columna lo actualiza solo), permisos `recibo.read/create/void`.
- L4: evidencia — jest 787/787, vitest 229/229, tsc 0, build OK; migración solo RENAME + UPDATE; filas iguales (22/26/24/20, role_permission 164); sin objetos `recibo_caja` en la base; permisos customer_payment.* en admin/accounts_admin (read/create/void) y gerencia (read). Pantalla: lista, detalle, nuevo, badge en CxC, /recibos-caja → 404. API real: crear recibo RC-000023 de $1.000 y anularlo → saldo CxC 643.500 → 642.500 → 643.500; GET /accounts-receivable/clients (SQL crudo) devuelve lastPaymentDate. Mutación seed (accounts_admin sin customer_payment.void) DETECTADA.
- L5: verificador independiente PASS S1/S3; revisión nativa no corrió (lens_context_budget_exceeded).
- L6: Judgment Day (2 jueces ciegos): 0 hallazgos graves → APPROVED. Informativos: JD-A-001/JD-B-001 sesiones abiertas conservan recibo.* en el JWT hasta re-login (máx. 8 h; forzarlo subiendo token_version tocaría el flujo de auth → no se hizo sin confirmación); JD-A-002/JD-B-002 frontend/CLAUDE.md:59 y :135 decían recibo_caja — corregido.
