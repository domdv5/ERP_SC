---
name: quantity_input_debounced_auto_advance
description: Inactivity-debounce pattern to auto-return focus to a scanner input after typing a quantity, without requiring Enter or a click.
metadata:
  type: project
---

`ProductRow.tsx` (`frontend/src/pages/documents/components/ProductRow.tsx`) implements the barcode-scan focus cycle (scan → quantity → scan). Enter-to-confirm already existed (`onKeyDown` on the quantity input calling `onQuantityConfirmed?.()`), but real warehouse operators never press Enter — they type the quantity digits and immediately point the scanner at the next barcode, so they had to click back into the scan input manually.

Fix (2026-08-10): added an inactivity debounce on the quantity `<input onChange>`. Constant `QUANTITY_AUTO_ADVANCE_DELAY_MS = 600` (module-level, next to `COST_DEVIATION_THRESHOLD`). A `useRef<ReturnType<typeof setTimeout> | null>` (`quantityDebounceRef`) is reset on every keystroke; if no new change arrives within 600ms, `onQuantityConfirmed?.()` fires automatically. Typing multiple digits fast ("15") keeps resetting the timer so it never fires mid-entry.

Key wiring detail: the quantity input already destructures `register(...)` into `{ ref: quantityRegisterRef, ...quantityRegisterRest }` and spreads `{...quantityRegisterRest}` (which includes RHF's own `onChange`/`onBlur`) onto the `<input>`. The custom `onChange`/`onBlur` handlers are declared **after** that spread in JSX so they take precedence, but each one still manually calls `quantityRegisterRest.onChange(e)` / `.onBlur(e)` first — never replace RHF's handler, always chain it, or form state stops updating/validating.

- `onBlur` also clears the pending timer — if the operator already moved on by click/Tab, don't steal focus back 600ms later.
- Enter's existing `onKeyDown` handler also clears the pending timer after calling `onQuantityConfirmed?.()`, to avoid a double-fire.
- A `useEffect` cleanup-on-unmount clears the timer too, in case the row is removed before the 600ms elapses (e.g. operator deletes the row right after typing).

This is the reference pattern for any future "debounced auto-action on inactivity" requirement in this codebase — distinct from the existing 400ms *search* debounce (which uses `use-debounce`'s `useDebounce` hook, not a raw ref+setTimeout), because this one needs imperative clear-on-blur/clear-on-unmount/clear-on-Enter control that a plain debounced-value hook doesn't expose.
