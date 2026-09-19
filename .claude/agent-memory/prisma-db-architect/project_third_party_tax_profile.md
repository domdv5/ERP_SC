---
name: third-party-tax-profile
description: ThirdParty tax fields (ivaResponsible/withholdingAgentType/taxRegime) are informational-only and ivaResponsible is deliberately tri-state — never add @default(false)
metadata:
  type: project
---

`ThirdParty` carries a "perfil tributario": `ivaResponsible Boolean?`, `withholdingAgentType WithholdingAgentType?`, `taxRegime TaxRegime?` (migration `20260811120000_third_party_tax_profile`, applied 2026-08-11).

**Why:** All three are **purely informative** — they drive no IVA or retención calculation anywhere; actual tax computation belongs to electronic invoicing (phase 2, not built). `ivaResponsible` is intentionally **tri-state** (`null` = not specified, `true`, `false`) and deliberately has **no `@default(false)`**, because "we never asked this third party" must stay distinguishable from "confirmed not IVA-responsible" — existing rows predate the field and must not be silently asserted as non-responsible.

**How to apply:** If a future task proposes adding `@default(false)` to `ivaResponsible`, backfilling it, or making any of the three fields non-nullable, flag it as contradicting an explicit design decision and confirm before doing it. Likewise, do not wire these fields into any tax/retention calculation without confirming phase 2 has actually started — the enum doc comments in `schema.prisma` state the informational-only constraint. The enums (`WithholdingAgentType`, `TaxRegime`) model Colombian DIAN concepts. Related: [[migration-history-divergence]].
