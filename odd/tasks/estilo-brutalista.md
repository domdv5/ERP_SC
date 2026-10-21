# Estilo brutalista industrial (toda la app)

Darle identidad visual a EloSC con un neo-brutalismo refinado ("industrial", de etiqueta de despacho) en toda la aplicación, más bento grid en el dashboard. Branch `feat/brutalist-style`.
Solo frontend (estilos). Sin cambios de lógica, rutas ni datos. El usuario no revisa estos cambios (L8): commits por tarea en la rama; push/PR quedan del usuario.

## Specs
- S1 — Afecta **toda la aplicación**, no solo el dashboard. Usuario: "quiero que afecte toda la aplciacion no solo el dashboard".
- S2 — Sin prototipo: se aplica directo en la app real. Usuario: "pero no quiero un prottopio".
- S3 — Rasgos del estilo (propuesta aceptada): bordes duros y visibles en lugar de sombras difusas; sombras sólidas desplazadas sin blur (`4px 4px 0`) en botones y tarjetas, que se "hunden" al hacer clic; radios chicos o rectos (nada de 16px tipo burbuja); números grandes en Prompt Black para KPIs y totales, con cifras tabulares; el verde `#07bc34` como acento puntual (botón principal, estado activo, highlight), no en todos lados; detalles de "etiqueta de despacho": códigos de documento en monoespaciada, pills con borde tipo sello.
- S4 — "Refinado": la legibilidad de tablas y formularios no empeora; modo claro y oscuro funcionan en todas las pantallas.
- S5 — Sin glassmorphismo ni `backdrop-blur` (login y overlays de modales pasan a superficies sólidas).
- S6 — Dashboard en bento grid (tarjetas de distinto tamaño según importancia).
- S7 — Primero los tokens globales en `frontend/src/index.css` (los radios/sombras de Tailwind v4 se redefinen en `@theme`, así las clases `rounded-*`/`shadow-*` ya usadas en ~60 archivos cambian desde un solo lugar); después componentes compartidos y layout; después pasada por páginas.
- S8 — No se usa shadcn ni otra librería de UI nueva.
- S9 — `frontend/CLAUDE.md` (Design Tokens, Typography, Shared Components) queda actualizado con el estilo nuevo.

## Tasks
- T1 — Tokens globales en `index.css`: radios, sombras sólidas, bordes, utilidades `gradient-*`/`nav-active`/`glass` planas, cifras tabulares, fuente mono (S3, S5, S7, S8). Route: react-code-crafter. Commit: 7d4ae6f ✅
- T2 — Layout y compartidos: Sidebar, Header, StatsGrid, TableToolbar, TablePagination, SegmentedToggle, EmptyState/ErrorState, Combobox, overlays de modales, botones con efecto de presión (S1, S3, S4, S5). Route: react-code-crafter. Commit: 562dddc ✅
- T3a — Pasada por páginas: documents, egresos, recibos-caja, official-ledger, official-purchases (S1, S3, S4, S5). Route: react-code-crafter. Commit: 6a3f248 ✅
- T3b — Pasada por páginas: products, third-parties, users, warehouses, accounts-receivable, accounts-payable, reports, stock-lookup, auth, coming-soon, test (S1, S3, S4, S5). Route: react-code-crafter. Commit: dba0d5a ✅
- T3 (detalle original) — Pasada por páginas (listados, formularios, detalles, POS, CxC/CxP, informes, login) corrigiendo lo que T1/T2 no cubran + códigos de documento en mono (S1, S3, S4). Route: partido en T3a/T3b. ✅
- T4 — Dashboard bento grid (S6). Route: react-code-crafter. Commit: 21f910f ✅
- T5 — `frontend/CLAUDE.md` + `tsc`/build del frontend + CodeTour (S9). Route: inline. Commit: ver Log L10 ✅ (CodeTour omitido: el usuario no revisa, L8)

## Log
- L1 (usuario, 2026-10-21): "antes de eso, estuve analizando el diseño de l aplicativo y la verdad se ve my bonito y moderno pero sinero que el ahce falta un punch algo que genere identidad y que no sea tan generico entonces vi algo como estilod e diseño o algo asi que son: brutalismo, minimalismo, neofuturismo, glassmorphismo, maximalismo, clayformismo,liquid glass, bento grid, ui espacial etc etc, entonces quisiera darle ese punch con aglo de eso, me iamgoimo qeu seria con shadcn o algoa si"
- L2 (asistente): recomendó neo-brutalismo refinado "industrial" + bento grid en dashboard; descartó glass/liquid glass/clay/maximalismo/UI espacial para un ERP; shadcn no da identidad.
- L3 (usuario): "no tengo otro estilo en mente"
- L4 (usuario): "pero no quiero un prottopio"
- L5 (usuario): "y quiero que afecte toda la aplciacion no solo el dashboard"
- L6 (exploración): no hay componentes `Button`/`Card` (`components/ui/` vacío); estilos repetidos inline: `rounded-2xl` 131×/45 archivos, `rounded-lg` 239×/52, `shadow-sm` 70×/31, `gradient-action` 41×/29, `border-ui-border` 326×/60. Palanca: redefinir variables de tema de Tailwind v4.
- L7 (T1): tsc + build OK. Pendiente para T2/T3: `text-white` sobre verde plano (~2,5:1) → `text-brand-primary`; login `.glass` ahora superficie del tema; `nav-active` con `shadow-lg` sobra; sombras recortadas por `overflow-hidden`; `.press` asume sombra de 3px.
- L8 (usuario, 2026-10-21): "sigue con todo y para estos cambiso nom hace falta que yo los revise"
- L9 (T2): utilidades nuevas `.btn-primary/.btn-secondary/.btn-danger/.card-hard/.input-hard/.pill-stamp` (movidas a `@layer components` para que las clases Tailwind de cada página les ganen), `.press`/`.press-sm`/`.border-hard`. Corte de slice tras 562dddc (~435 líneas): T3a, T3b y T4 van en commits propios; la entrega (un PR o PRs encadenados) la decide el usuario.
- L10 (T3/T4/T5): tsc + build OK; `card-hard` fija `--press-offset: 4px`; frontend/CLAUDE.md actualizado (estilo, clases de componente, utilidades, mono). Sin verificación visual en navegador. Pendiente menor: códigos de documento dentro de frases siguen en fuente normal; checkboxes con `focus:ring-*/30`; chips `rounded-full` de marcas.
- L11 (usuario, 2026-10-21): "el sidebar me parce que quedo como difenrete al resto" (captura en modo oscuro). Fix b19e322: ítem activo = bloque verde sólido con borde duro y sombra (`.nav-active`), hover con borde duro, bordes del sidebar con tokens semánticos.
- L12 (revisión visual con Playwright, 15 pantallas claro/oscuro): bien en claro (listados, cifras Prompt, formularios, login). Problemas: (1) dashboard con jerarquía invertida — tiles grandes CxC/CxP muestran "—"/"MÓDULO EN DESARROLLO" y Productos tiene espacio vacío; (2) demasiado verde sólido (sidebar activo, toggles, botones: 5 bloques verdes en Nueva venta); (3) sombra gris `#8b968f` en oscuro parece contorno fantasma; (4) `btn-primary` deshabilitado verde opaco ambiguo; (5) borde izquierdo azul en "Información general" de Nueva operación.
- L13 (usuario): "dale" — aplicar: tiles grandes = números reales, módulos en desarrollo chicos; verde solo en el botón principal de cada pantalla; activo del sidebar y opción elegida de toggles = bloque casi negro con texto verde (en oscuro superficie clara con borde); sombra negra pura en oscuro con borde más visible; deshabilitados en gris neutro; borde azul al estilo común.
- T6 — Ajustes tras revisión visual (L12–L13). Route: react-code-crafter. Commit: ver L14 ✅
- L14 (T6): `.selected-ink` (claro: casi negro + texto verde; oscuro: casi blanco + texto oscuro) en sidebar activo, toggles, paginación, períodos e íconos; `--hard-shadow` negro en oscuro con bordes más visibles; deshabilitados grises; sin bordes izquierdos de color; dashboard en dos grillas (KPIs `lg:grid-cols-5`, financieras aparte) sin huecos. Re-verificado con Playwright (dashboard claro/oscuro, POS oscuro, Operaciones oscuro, Informes, Nueva operación). tsc + build OK.
- L15 (usuario, 2026-10-21): Tipo de persona del form de terceros "quedo raro con respecto a los otros"; y sobre el borde izquierdo de color de "Información general": "se ponia como una especiae de colro al aldo en el fondo donde la gente sabia donde estaba parada teniendi en cuenta el color del icono". Error de L12: ese borde tenía significado (tipo de documento). Fix: borde `border-l-[6px]` por tipo restaurado en form, POS y detalle; Tipo de persona con `selected-ink`. Verificado con Playwright claro/oscuro.
- L16 (revisión visual final): 4 arreglos de pulido aprobados por el usuario ("dale"): links de nombre en verde → texto normal con subrayado al hover; inicialitas de listados con borde fino sin relleno; ítem activo del sidebar en oscuro gris claro en vez de casi blanco; contraste del ícono de RecibosCajaNewPage y foco del BarcodeScanInput igual a `.input-hard`.
- T7 — Pulido final (L16). Route: react-code-crafter. Commit: ver L17 ✅
- L17 (T7): `.link-plain` (nombres/links en color del texto, subrayado al hover), `.avatar-outline` (iniciales con borde fino), `--ink-bg` oscuro `#c9d1cc`, ícono de recibo hereda `--ink-fg`, `BarcodeScanInput` con `.input-hard`. Verificado con Playwright (CxC oscuro, Terceros claro). tsc + build OK.
