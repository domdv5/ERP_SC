---
name: decimal-as-string-recurring-bug
description: Recurring bug class in this repo — Prisma Decimal fields arrive as JSON strings while the frontend types declare them as number; audit this first on any money-related frontend diff
metadata:
  type: project
---

Los campos `Decimal` de Prisma (`totalAmount`, `paidAmount`, `balance`, `creditApplied`, `amount`, `total`, `cashTotal`, `creditTotal`, …) viajan por HTTP como **string** en el JSON, pero las interfaces TypeScript del frontend los declaran como `number`. El compilador no ayuda: hay que envolver en `Number(...)` a mano en cada sitio donde se sumen, resten o comparen.

**Why:** ya explotó tres veces (`DocumentDetailPage` histórico; el resolver de zod del formulario de Egresos rechazando su propio default; y el riesgo latente en el rework de Cuentas por Pagar 2026-09-18). El equipo eligió a propósito dejar el tipo como `number` y documentarlo con un comentario en `types/accounts-payable.types.ts` en vez de tiparlo como `string`, así que la única defensa real es la disciplina en el sitio de uso.

**How to apply:** en cualquier auditoría o revisión de un diff de frontend que toque dinero, el primer barrido es buscar campos numéricos venidos del backend usados en `+ - * /`, comparaciones, `Math.*` o `reduce` sin `Number(...)` delante. Ojo con los falsos positivos: `Math.min`/`Math.max`/`Intl.NumberFormat.format` coaccionan strings solos, así que "funciona" y el bug solo aparece con `+` (concatenación) o al pasar por `z.number()`.
