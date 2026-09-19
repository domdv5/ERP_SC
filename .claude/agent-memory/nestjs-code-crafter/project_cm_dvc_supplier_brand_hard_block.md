---
name: cm-dvc-supplier-brand-hard-block
description: CM/DVC now hard-reject document items whose product's brand doesn't belong to the document's supplier — implemented 2026-08-12
metadata:
  type: project
---

`BaseEffectStrategy.assertItemsMatchSupplierBrands(supplierId, items: {productId, brandId}[])` (`backend/src/documents/strategies/base-effect.strategy.ts`, added next to `assertValidSupplier`) throws `BadRequestException` if any item's `brandId` isn't among the supplier's active brands. Called from both `CmEffectStrategy` and `DvcEffectStrategy`:
- `validateCreate()` — resolves `brandId` via a fresh `prisma.product.findMany` on the DTO's `productId`s (items aren't hydrated with `product` yet at this point).
- `confirm()` — reuses `document.documentItems[].product.brandId`, already hydrated by `DocumentWithItems`'s include (`product: true`) — no extra query needed.

**Why duplicated in both hooks**: `documents.service.ts::update()` (PATCH on a draft) does not revalidate — a comment in that file says so explicitly (~line 242-245 as of 2026-08-12). Without the `confirm()`-time check too, a brand-mismatched item could be patched into an already-validated draft and slip through on confirm.

**Why `Supplier.id` is safe to pass directly as `supplierId`**: `Supplier.id` is an FK to `ThirdParty.id` (`@relation(fields: [id], references: [id])` in schema.prisma) — true 1:1, no separate supplier UUID. `createDocumentDto.thirdPartyId` IS the supplier id; no intermediate resolution needed anywhere in this codebase when going ThirdParty→Supplier.

Also touched as part of the same change (all read-side, no schema changes):
- `products.service.ts::findAll` — new `supplierId` filter (`FindAllProductsDto`) resolves the supplier's active brand ids and filters `Product.brandId: { in: [...] }`. Precedence over the pre-existing singular `brandId` filter (which `ProductsPage.tsx` admin UI still uses) — both coexist, `supplierId` wins if both are ever sent together.
- `documents.service.ts::DETAIL_INCLUDE.thirdParty` — extended to include `supplier.brands` (active only) so editing an existing CM/DVC draft loads the supplier's brand list without a second request (frontend needs this to enable/filter the product picker on edit).

See the frontend counterpart (built in parallel, not by this agent) for the UI half: disables product search/barcode scan until a supplier is chosen, filters/blocks by these same brand ids client-side.
