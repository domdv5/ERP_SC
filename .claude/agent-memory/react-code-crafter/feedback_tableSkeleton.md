---
name: feedback-tableSkeleton-tuple
description: TableSkeleton widths prop is a strict 4-element tuple — never pass more or fewer strings
metadata:
  type: feedback
---

`TableSkeleton` from `@/components/shared` requires `widths` to be typed as `[string, string, string, string]` — exactly **4 strings**.

Passing 5, 6, or 7 strings causes a TypeScript error: `Type 'string[]' is not assignable to type '[string, string, string, string]'`.

**How to apply:** When using `TableSkeleton`, always pass exactly 4 widths. If the table has more columns, choose representative widths for the 4 most relevant columns.
