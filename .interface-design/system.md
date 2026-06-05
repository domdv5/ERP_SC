# EloSC Interface Design System

## Direction & Feel

**Product:** ERP supply chain for a Colombian commercial distributor ("Surtidora de Comerciantes").
**User:** Business operator — warehouse manager, billing clerk, or owner. Opens the app to get a pulse on the operation.
**Feel:** Operational, trustworthy, modern. Dense enough to show real information. Not a SaaS startup — a working tool.

## Depth Strategy

**Borders only** for light surfaces (cards, table rows, inputs).
**Surface color** for elevation on dark (sidebar dropdowns use `bg-brand-surface` one step lighter than `bg-brand-primary`).
No dramatic drop shadows — `shadow-sm` on cards, `shadow-md` on hover. Never `shadow-2xl` on static elements.

## Color Palette

| Role | Token | HEX |
|------|-------|-----|
| Dark primary | `bg-brand-primary` | `#141a17` |
| Dark light | `bg-brand-primary-light` | `#1f2b24` |
| Dark page | `bg-brand-primary-dark` | `#0d1210` |
| Dark surface | `bg-brand-surface` | `#1e2820` |
| Brand green | `bg-brand-secondary` | `#07bc34` |
| Green light | `bg-brand-secondary-light` | `#09d93c` |
| Green dark | `bg-brand-secondary-dark` | `#059928` |

Opacity modifiers work natively: `bg-brand-secondary/10`, etc.

**Semantic colors in use:**
- Green (`#07bc34`) — confirmed, active, positive, primary actions
- Blue (`#3b82f6`) — payables, outflow, secondary financial metric
- Amber (`#f59e0b`) — pending, warnings (available but not yet used)
- Red — destructive actions only (delete, logout hover)

## Typography

| Font | Weight | Role | Applied via |
|------|--------|------|------------|
| Prompt | Black 900 | Headings (h1–h6) | `@layer base` — automatic |
| Barlow | Regular 400 | Body text | default `font-sans` |
| Barlow | Medium Italic 500 | Subtitles, supporting text | `.font-accent` class |

Never add explicit font-weight to headings. Never use Inter — it was replaced.

## Spacing Base Unit

`4px` (Tailwind default). Scale: `gap-1` (4px) → `gap-2` (8px) → `gap-3` (12px) → `gap-4` (16px) → `gap-6` (24px) → `gap-8` (32px).

## Component Patterns

### Cards
```
rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all
```
- Light surface: `bg-white`
- Dark surface: `bg-brand-primary` with `border-white/10`

### Buttons — primary CTA
```
gradient-action text-white rounded-xl px-4 py-2 text-sm font-medium
hover:opacity-90 hover:shadow-lg active:scale-[0.98] transition-all
```

### Icon containers
```
w-10 h-10 rounded-xl flex items-center justify-center bg-brand-secondary/10
```
Icon: `text-brand-secondary w-5 h-5`

Smaller variant: `w-9 h-9 rounded-xl`, icon `w-4 h-4`

### User avatars
```
gradient-user rounded-full flex items-center justify-center text-white font-bold
```

### Empty states
```html
<div class="gradient-dark w-10 h-10 rounded-2xl flex items-center justify-center mb-3">
  <Icon class="text-white/50" />
</div>
<p class="text-gray-500 text-sm">No hay X</p>
<p class="text-gray-400 text-xs mt-1 font-accent">Descripción de apoyo</p>
```

### Table rows
```
hover:bg-gray-50/60 transition-colors group
```
Action buttons: `opacity-0 group-hover:opacity-100 transition-opacity`
Edit hover: `hover:text-brand-secondary hover:bg-brand-secondary/10`

### Search inputs
```
bg-gray-50 border border-gray-200 rounded-lg
focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary
```

### Sidebar NavLink active
```
nav-active text-white shadow-lg
```
Inactive: `text-white/60 hover:text-white hover:bg-white/5`

### Pagination active page
```
gradient-action text-white
```
Inactive: `text-gray-500 hover:bg-gray-100`

## Gradient Utilities Reference

All defined in `src/index.css` `@layer utilities`:

| Class | CSS | Use |
|-------|-----|-----|
| `gradient-action` | `linear-gradient(135deg, #07bc34, #059928)` | CTA buttons, active states |
| `gradient-dark` | `linear-gradient(135deg, #141a17, #1f2b24)` | Empty state icons |
| `gradient-user` | `linear-gradient(135deg, #141a17, #07bc34)` | User avatars |
| `gradient-brand` | `linear-gradient(135deg, #141a17 0%, #1f2b24 50%, #07bc34 100%)` | Decorative |
| `nav-active` | green tint bg + 3px left border | Sidebar active item |
| `glass` | `backdrop-blur + bg white/5 + border white/10` | Dark panel forms |
| `text-gradient-brand` | green gradient text clip | Hero headings |
| `font-accent` | Barlow 500 italic | Subtitles, supporting text |

## Dashboard Layout Pattern

Two-tier hierarchy (never uniform grid):
1. **Financial zone** (`md:grid-cols-2`) — primary metrics, larger cards, `text-3xl` numbers
2. **Operational zone** (`xl:grid-cols-4`) — secondary metrics, compact cards, `text-lg` numbers, horizontal layout

## What to Avoid

- Hardcoded hex values (`#07bc34`, `#141a17`) anywhere in components — use token classes
- `font-bold` on headings (Prompt Black is automatic)
- `shadow-2xl` on static sidebar/layout elements
- Multiple accent colors — green is the only brand accent
- `style={{ background: 'linear-gradient(...)' }}` — use gradient utilities instead
