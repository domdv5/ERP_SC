---
name: credit-tables-split
description: CustomerCredit y SupplierCredit se mantienen como tablas paralelas separadas (no unificadas) — razón y plan de simetría para la fase de ventas
metadata:
  type: project
---

Recomendación arquitectónica (2026-07-27): **no unificar** `CustomerCredit` y `SupplierCredit` en una tabla genérica de crédito. Se mantienen como tablas paralelas, igual que el precedente ya establecido con `AccountsPayable` / `AccountsReceivable`.

**Why:**
- La tabla de aplicaciones es lo que rompe la unificación, no la de crédito. `SupplierCreditApplication.accountPayableId` apunta a `AccountsPayable`; el equivalente cliente apuntaría a `AccountsReceivable`. Como AP/AR ya están separadas por decisión previa, una `CreditApplication` unificada necesitaría dos FK nullables + CHECK XOR — algo que Prisma no expresa y que rompe los `include` tipados.
- La asimetría no es accidental y va a crecer: `expired` solo aplica a cliente (vencimiento de saldo a favor); `bankDestination`/flujo de aplicación difiere; el lado cliente arrastra `sellerId` como AR.
- Técnicamente una FK polimórfica SÍ sería viable (`Customer.id` y `Supplier.id` son ambos `ThirdParty.id`, mismo namespace), pero se perdería la garantía a nivel DB de que el crédito pertenece a un tercero del rol correcto — `isCustomer`/`isSupplier` son booleanos, no restricciones.

**How to apply:**
- Al implementar la fase 2 de ventas (`COT`/`POS`/`DVV`), reescribir `CustomerCredit` **espejando la forma de `SupplierCredit`** (hoy es scaffolding muerto: cero usos en `backend/src` y `frontend/src`): agregar `@default("available")` en `status`, `@@index([thirdPartyId, status])`, y crear `CustomerCreditApplication` con FK a `AccountsReceivable`.
- Compartir el **comportamiento**, no la tabla: la aritmética en centavos, la validación del invariante `0 <= balance <= amount` y la selección FIFO de créditos deben extraerse a un helper compartido — pero recién cuando exista el segundo consumidor real (regla de ≥2 consumidores concretos).
- Ver [[warehouses-subentities]] para el otro precedente de "no crear módulo/tabla nueva sin lifecycle propio".
