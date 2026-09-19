---
name: segmented-toggle-shared-component
description: Shared SegmentedToggle component extracted from duplicated Activos/Inactivos pill-toggle in ProductsPage and ThirdPartiesPage
metadata:
  type: project
---

`SegmentedToggle` (`frontend/src/components/shared/SegmentedToggle.tsx`, exported from the `@/components/shared` barrel) is the two-option pill toggle used for list-page Activos/Inactivos filters. Props: `checked: boolean`, `onChange: (checked: boolean) => void`, `uncheckedLabel: string`, `checkedLabel: string` — labels are parameterized so it isn't tied to the Activos/Inactivos wording specifically.

**Why it exists**: `ProductsPage.tsx` and `ThirdPartiesPage.tsx` each had an identical ~23-line inline toggle block (only quote-style differed) for their `showInactive` state. Flagged in a `/code-review` pass and extracted per the project's CLAUDE.md rule: "Extract an inline component when duplicated in 2+ files."

**How to apply**: any future list page needing a two-state pill toggle (not just Activos/Inactivos — e.g. any boolean filter rendered as two adjacent buttons with `gradient-action` on the active side) should use `<SegmentedToggle checked={...} onChange={...} uncheckedLabel="..." checkedLabel="..." />` instead of hand-rolling the button pair. Don't add a third state — this component is strictly binary; a segmented control with >2 options needs a different component.
