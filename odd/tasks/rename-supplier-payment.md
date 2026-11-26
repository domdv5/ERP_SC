# Renombrar egreso → supplier_payment (PR 1 de 2)

Pasar a inglés los nombres técnicos del egreso (tablas, carpetas, archivos, clases, rutas, permisos, contrato). Lo que ve el usuario sigue en español. PR 2 (recibo de caja → customer_payment) va aparte.

## Specs

- S1 — Mapa de nombres aprobado por el dueño ("dale", 2026-11-26):
  - Tablas: `egreso` → `supplier_payment`; `egreso_payment` → `supplier_payment_method`; `egreso_allocation` → `supplier_payment_allocation`; columna `egreso_id` → `supplier_payment_id` (en `supplier_payment_method`, `supplier_payment_allocation` y `supplier_credit_application`).
  - Modelos Prisma: `Egreso` → `SupplierPayment`; `EgresoPayment` → `SupplierPaymentMethod`; `EgresoAllocation` → `SupplierPaymentAllocation`.
  - Enums: `EgresoVoidReason` → `SupplierPaymentVoidReason`; `EgresoPaymentMethod` (lo comparte el recibo de caja) → `TreasuryPaymentMethod`. Los VALORES de los enums no cambian.
  - Carpetas: `backend/src/egresos/` → `backend/src/supplier-payments/`; `frontend/src/pages/egresos/` → `frontend/src/pages/supplier-payments/`.
  - Archivos y clases: `egresos.service.ts` → `supplier-payments.service.ts` (`SupplierPaymentsService`), igual controller/module/DTOs (`create-supplier-payment.dto.ts`, `void-supplier-payment.dto.ts`, `find-all-supplier-payments.dto.ts`); pantallas `SupplierPaymentDetailPage`, `SupplierPaymentNewPage`, `SupplierPaymentsListPage`, `VoidSupplierPaymentDialog`, etc.
  - Contrato: `backend/src/contracts/egresos.ts` → `backend/src/contracts/supplier-payments.ts`.
  - Rutas: API `/egresos` → `/supplier-payments`; navegador `/egresos` → `/supplier-payments`.
  - Permisos: `egreso.create/read/void` → `supplier_payment.create/read/void`.
- S2 — No cambia: textos en pantalla ("Egresos", "Nuevo egreso"…), valores de enums, la clave `EGRESO` de `Sequence` (dato), comentarios de tablas, variables sueltas de otros conceptos (`preventa`, `excedente`, `remision`). Sin redirecciones de rutas viejas (caen en la 404).
- S3 — La migración renombra (`ALTER TABLE/TYPE/INDEX/CONSTRAINT ... RENAME`), nunca borra ni copia datos; después `prisma migrate diff` contra la base no debe mostrar cambios (salvo los 2 índices trigram aceptados). Respaldo previo: `pg_dump` en temp (`erp_db_pre_supplier_payment.dump`).
- S4 — `CLAUDE.md` raíz: la regla "los nombres de documentos del negocio se quedan en español" se reemplaza por "identificadores en inglés, también los conceptos del negocio; los textos que ve el usuario siguen en español". Docs de backend/frontend apuntan a los nombres nuevos.
- S5 — Sin cambio de comportamiento: jest y vitest completos pasan; `tsc` backend y build frontend sin errores.

## Tasks

- T1 [S1,S3,S5] schema + migración + backend + seed RBAC + contrato + backend/CLAUDE.md — nestjs-code-crafter — commit: pendiente
- T2 [S1,S2,S5] frontend (carpeta, pantallas, rutas, permisos, import del contrato) + frontend/CLAUDE.md — react-code-crafter — commit: pendiente
- T3 [S4] regla de nombres en CLAUDE.md raíz — parent — commit: pendiente
- T4 [S5] verificación completa, PR — parent — commit: pendiente

## Log

- L1 (dueño, 2026-11-26): "antes de esto, hay algo que quiero hacer primero es que tanto en la bd como el nombre de las carpetas del proyecto está en spanglish y la verdad no me gusta puedes explorar y decirme cuáles son y proponer un plan para cambiarlo"
- L2 (dueño): "los valores en español no me importa tanto ni las variables tampoco tanto, es más el nombre de las carpetas y de las tablas" → se acotó a egreso y recibo de caja completos (2 PRs); valores de enums y variables sueltas quedan.
- L3 (dueño): "dale" al mapa de nombres `supplier_payment` / `customer_payment`. Redirecciones de rutas viejas: sin respuesta → no se hacen.
- L4: decisión del parent: el enum compartido `EgresoPaymentMethod` pasa a `TreasuryPaymentMethod` (lo usa también el recibo de caja, así que no puede llevar "SupplierPayment").
