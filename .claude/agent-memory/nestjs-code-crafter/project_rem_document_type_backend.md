---
name: rem-document-type-backend
description: REM (Remisión) backend shipped 2026-09-08 — AbstractReservationStrategy extraction, shared PV+REM reservation, pending frontend
metadata:
  type: project
---

REM (Remisión) document type backend implemented 2026-09-08 per `plans/024-remision-rem-document-type.md` (approved). Frontend is the next session (workflow: Planificador → Backend → Frontend).

**Why:** REM = transitional "casi-PV" sales doc — logical stock reservation, no physical movement, convertible to POS/COT. Reuses all PV infrastructure.

**How to apply / what shipped (details in `backend/CLAUDE.md`, don't duplicate here):**
- `AbstractReservationStrategy` (`documents/strategies/abstract-reservation.strategy.ts`) extracted from the old `PvEffectStrategy`. It's now THE extension point for reservation-type docs — `DVV` should extend it next, not copy-paste. Subclasses are thin: `type` + `protected abstract readonly entityNoun`.
- `RESERVATION_TYPES = [PV, REM]` in `reservation.helpers.ts` is the canonical list; `void()`/`convert()` guards in `documents.service.ts` import it rather than inline `[PV, REM]`. `pv-status.helper.ts` keeps its own local `CONVERTIBLE_TYPES` copy on purpose (widely imported, kept self-contained).
- The computed `pv` block key is deliberately NOT renamed to `conversion` (frontend depends on the name); it's now non-null for REM too. If asked to "rename pv to conversion", that's a coordinated frontend change, not a rename.
- Generic Document audit fields added: `updatedById` / `convertedById` / `convertedAt` (migration `20260908120000_add_document_updated_converted_by`, additive). Same criterion as `confirmedById`/`voidedById` — not REM-only.
- `GET /products` gained `remisionQuantity` as a SEPARATE field from `reservedQuantity` (PV stays PV-only); `availableStock = totalStock - reservedQuantity - remisionQuantity`.
- RBAC seed: `document.release.REM` / `document.convert.REM` added; `admin` + `basket_management` get all 3 REM perms; `purchasing` keeps only its pre-existing `document.create.REM`. Users must re-login (perms in JWT).

Related: [[pos-pv-conversion-feature]] (`consumeForConversion`, POS confirm shortfall shape).
