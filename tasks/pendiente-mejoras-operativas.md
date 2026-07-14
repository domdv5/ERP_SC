# Pendiente: Mejoras operativas varias

## Productos / Marcas

- Nuevo producto: identificación → marca
- Unidad de medida (unidad/docena) en la creación de producto — ✅ implementado, versión acotada: campo `Product.unitOfMeasure` (`unidad`|`docena`, default `unidad`, migración `20260714120000_add_product_unit_of_measure`), selector en `ProductForm.tsx`, y solo se muestra como etiqueta informativa ("Se maneja por docena") junto a la cantidad en documentos de traslado (`T`) — confirmado con el usuario que **no** hace ninguna conversión/multiplicación automática, no toca `Inventory`/`BinStock`/costos en ningún tipo de documento. Esto resuelve de forma acotada la brecha #2 de `plans/007-binstock-traslados-inventario-real.md` ("Unidad de medida — falta en el schema") — la versión completa de esa nota (conversión automática docena↔unidad al vender) sigue bloqueada hasta la reunión con el stakeholder; lo implementado aquí es deliberadamente solo informativo, no la resuelve del todo.
- Permitir añadir a un mismo código dos (o más) marcas del mismo proveedor
  - **Decisión de diseño pendiente** (schema, requiere `prisma-db-architect`): hoy `Product.code` es `@unique` global y `Product.brandId` es una FK única — 1 código = 1 marca = 1 costo = 1 stock.
  - **Opción A (recomendada) — relación muchos-a-muchos `Product` ↔ `Brand`**: un solo producto físico (un `id`, un costo, un stock) puede etiquetarse con varias marcas. No rompe el invariante `Inventory`/`BinStock` (siguen atados a un único `productId`). Hay que: (1) migrar los filtros `where: { brandId }` a filtro por relación, (2) decidir qué marca se imprime en factura/kardex cuando hay varias, (3) convertir el combobox de marca en `ProductForm.tsx` a multi-select (hoy está bloqueado tras crear el producto).
  - **Opción B — mismo código, varias filas de `Product`** (`@unique([code, brandId])` en vez de `code @unique`): rompe el supuesto de que "código identifica un único producto" en toda búsqueda por código (POS, combobox, línea de factura de compra); cada marca tendría su propio `avgCost`/`lastCost`/`Inventory` independiente aunque compartan código — inconsistente con la intención de la nota. No recomendada.
  - Bloqueado hasta reunión con stakeholder (ver `plans/007-...`, gitignored).
- Añadir descuento del 2% al precio mínimo de venta — ✅ implementado en `ProductForm.tsx` (auto-cálculo -2% al crear, editable manualmente)
- En producto: la opción de editar debe priorizarse solo para usuarios autorizados
- Añadir casilla de costo ponderado y último costo de entrada — ✅ implementado en `ProductsPage.tsx` (columnas "Costo Prom." y "Últ. Costo")
- Consultar los procesos de ponderación para entradas y salidas de inventario — resuelto por consulta (ver explicación abajo)
  - **Por qué el costo se pide en la entrada (EAI) y no en la salida (SAJ)**: en una entrada llegan unidades con costo *externo* desconocido por el sistema (compra, hallazgo, corrección) — por eso se pide. En una salida no hay información nueva: lo que sale ya estaba mezclado en el promedio ponderado vigente, así que `SajEffectStrategy` siempre usa `product.avgCost` y ni siquiera muestra el campo en el formulario (`ProductRow.tsx`, `showCost` excluye `SAJ`). Dejar elegir el costo de salida permitiría fabricar/destruir valor de inventario sin una transacción real detrás.
  - **Traslado manual de costo entre productos (caso B→A)**: hoy se hace con dos documentos independientes — SAJ que vacía B (a su `avgCost` automático) + EAI que entra a A con el costo que se escriba a mano. Es matemáticamente correcto **solo si** ese costo escrito es el `avgCost` real que tenía B — si se escribe cualquier otro número, se corrompe el promedio de A sin ninguna alerta. No hay operación atómica de "fusionar producto" en el schema — si se necesita seguido, vale la pena construir una que preserve el valor total automáticamente (`(stockA×avgCostA + stockB×avgCostB) / (stockA+stockB)`) y no dependa de que el usuario escriba el número correcto.
  - ✅ Implementado: alerta visual en `ProductRow.tsx` (documentos EAI) cuando el costo digitado se aleja >30% del costo promedio actual del producto seleccionado — mitiga el riesgo de error de digitación (ej. falta un cero) que antes pasaba sin ningún aviso.
- Revisar cómo afecta la unificación de productos de diferente costo en SAJ y EAI — ver punto anterior; sigue pendiente la operación de "fusión de producto" atómica si el caso se vuelve frecuente

## Bodega

- Bodega → traslados
  - ✅ Implementado: un bulto con stock (`occupied`, derivado de `SUM(BinStock.quantity) > 0`) ya no aparece como opción en el selector de bulto destino de un traslado — se calcula en `WarehousesService.findOne` (backend), sin campo nuevo en el schema ni migración. Vuelve a aparecer automáticamente en cuanto se vacía por completo. Confirmado con el usuario: un bulto ocupado no recibe más contenido hasta vaciarse (no se permiten varios traslados sobre el mismo bulto mientras tenga stock). La gestión de bultos en Bodegas (admin) sigue mostrando todos, ocupados o no — el filtro solo aplica al selector de destino del formulario de traslado.
- Cambiar nombre de "bolsas" a "bultos" — ✅ implementado en `WarehousesPage.tsx`, `BinForm.tsx` y `DetailPanel.tsx` (incluye concordancia de género: "el bulto", "creado", "nuevo bulto")
- En formulario de bodega: eliminar casilla de tallas o considerar una lista general

## Operaciones / Compras

- En compras: la casilla de flete no es necesaria
- En compras: organizar opción de agregar ítems, no dar clic sino usar tecla de retroceso (TAB) para mayor agilidad — ✅ resuelto de forma más completa: se implementó un campo de escaneo de código de barras (`BarcodeScanInput.tsx`) sobre la tabla de ítems de documentos, aplica a todos los tipos (CM incluida), agrega o suma cantidad automáticamente sin usar el mouse
- En compras borrador: no es necesario agregar el número del documento; el número de doc/factura se debe asignar al confirmar la compra y debe ser en serie/consecutivo

## Facturación

- Rebajar 10 unidades de cobra a costo (nota parcialmente ilegible en la foto)
- En facturación: agregar una casilla que sume el total de prendas
