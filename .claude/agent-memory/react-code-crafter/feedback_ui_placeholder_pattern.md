---
name: feedback-ui-placeholder-pattern
description: How to build a "coming soon" action button when the user wants a visual reminder but backend support doesn't exist yet
metadata:
  type: feedback
---

When asked to add a button for a feature whose backend doesn't exist yet (placeholder/reminder only, not functional): make it `disabled` with a native `title` tooltip explaining when it'll be available, matching the existing `disabled:opacity-50 disabled:cursor-not-allowed` pattern already used throughout the frontend (`ThirdPartyForm.tsx`, `ProductForm.tsx`, `RegisterPaymentForm.tsx`, dialogs' confirm buttons, etc. — grep `disabled:opacity` for more examples). No native `title`-tooltip-on-disabled-button precedent existed elsewhere in the codebase before this, but it's a reasonable minimal addition since the alternative (clickable + toast.info) adds a fake-feeling interaction for something that isn't real yet.

**Why:** User was explicit — wants the button "presente como recordatorio visual," not functional, and explicitly forbade wiring it to any real/nonexistent endpoint or adding new service/type files for it.

**How to apply:** Before inventing a new disabled-button style, grep the codebase for `disabled:opacity` — there's already a consistent convention to match. Don't build a custom tooltip component for a one-off placeholder; native `title` is enough.
