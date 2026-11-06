Contrato front/back (A4) — extender el patrón del piloto de documentos a los demás módulos.
Mismo patrón que `odd/tasks/contrato-documentos.md`: contrato escrito a mano en `backend/src/contracts/`, backend lo cumple con `matchContract`, frontend lo importa con `import type`.
Un PR por grupo de módulos. PR 1 en rama `feature/contrato-catalogos`.

## Specs

- S1 — Patrón (igual al piloto): contrato con tipos planos en `backend/src/contracts/<modulo>.ts`, exportado en `contracts/index.ts`; el service envuelve lo que devuelve con `matchContract<Contrato>()`; el frontend importa con `import type` desde `@contracts/*` y borra su copia en `src/types` (los payloads de crear/editar se quedan en el frontend). Los usos que marque el compilador se corrigen sin cambiar lo que se ve en pantalla.
- S2 — Si el contrato destapa un campo que el frontend espera y el backend no manda (o al revés), se muestra al usuario antes de decidir qué hacer.
- S3 — PR 1, catálogos: productos (`GET /products`, `/products/brands`, `/genders`, `/categories`, `/by-code/:code`, `/by-code/:code/locations`, `/:id`, y lo que devuelven POST/PATCH/DELETE/reactivate), bodegas (`/warehouses`, `/:id`, zonas y bultos) y ubicaciones (`/locations/departments`, `/departments/:code/cities`).
- S4 — PR 2: terceros. PR 3: cuentas por cobrar y por pagar. PR 4: egresos y recibos de caja. PR 5: libro oficial, reportes, sistema.
- S5 — Regla en `CLAUDE.md` raíz, sección "Contrato front/back": "Todo endpoint nuevo que el frontend consuma nace con su contrato en `backend/src/contracts/`." Y la carpeta `design/` va en `.gitignore`.

- S6 — "en la lsita de productos esta bien, porque es el disponible total, entre alamcen , bodega, restando preventa y remision cierto? en las ventas ese disponible tiene que ser el del alamcen osea el tipo store". La respuesta (no la BD) suma `availableToSell` = stock de bodegas activas tipo `store` − preventas − remisiones confirmadas (misma fórmula que valida la confirmación), en la lista de productos y en `by-code`. `availableStock` no cambia. El aviso de disponible de todos los documentos que sacan mercancía, salvo traslados (que siguen con el stock de la bodega de origen), y del carrito POS usa `availableToSell`.

## Tasks

- T1 — S1, S3 — nestjs-code-crafter — contratos de productos, bodegas y ubicaciones + `matchContract` en sus services — commit: 3b96cd0
- T2 — S1, S2, S3 — react-code-crafter — frontend importa del contrato, borra `product.types.ts`/`warehouse.types.ts`/`location.types.ts` (salvo payloads) + `availableStock` en by-code — commits: 6ac9bf6, 5a274f0
- T3 — S5 — inline — regla en CLAUDE.md, `.gitignore`, backlog — commit: a825a36
- T8 — S6 — inline backend (regla) + react-code-crafter (frontend) — commit: "fix(products): ventas muestran el disponible solo de la tienda"
- T4 — S4 — PR 2 terceros — commit:
- T5 — S4 — PR 3 CxC y CxP — commit:
- T6 — S4 — PR 4 egresos y recibos de caja — commit:
- T7 — S4 — PR 5 libro oficial, reportes, sistema — commit:

## Log

- L1 — Usuario (2026-11-06): "hola una vez quedaron unos pendinetes de seguridad y acoplamenito sabes cuales eran?" → se le recomendó A4; respondió "dale". Plan de 5 PRs aprobado con "dale".
- L2 — Usuario: "de ahbora en dalente cierto que ya se escribe en contract? y porfa la carpta de desing borrarla o ignoraal" → se ignora `design/` (no se borra: tiene maquetas del canvas) y se agrega la regla de endpoint nuevo con contrato. Respuesta: "dake" (= dale, PR 1).
- L3 — Evidencia T1: tsc limpio, 611 tests; romper un campo del contrato hace fallar tsc (verificado y revertido). Diferencias: `brand.supplier` solo viaja en `/products/brands`; `legacyCode` siempre viaja; `GET /products/:id` y `/warehouses/:id` devuelven `null` si no existe (no 404); `City.department` no lo manda `/locations` (sí lo usa `ThirdPartyForm` con las ciudades del tercero → queda para PR 2). Todas se resuelven tipando lo real, sin cambiar comportamiento. Corte de slice: T1 (backend, 438 líneas) es un commit; T2 (frontend) va en otro.
- L4 — T2 destapó bug previo: `GET /products/by-code/:code` nunca mandó `availableStock`, así que el aviso de disponible no aparece al escanear (documentos, `BarcodeScanInput.tsx:128`) ni en el carrito POS (`SaleCart.tsx:160`). Usuario: "espere esper, es que no entenid que problema esta teniedl el usaurio y donde" → explicado; respuesta "dale" a la opción (a): el backend calcula `availableStock` en `by-code` con la misma lógica que el listado y se suma al contrato.
- L5 — Revisión independiente (jd-judge-a): sin defectos bloqueantes; quité `matchDetailContract` sin uso y corregí el hash de T3. Señaló que el disponible suma Almacén + Bodega. Usuario: "no se peude contar con bodega porque primero hayq ue ahcer el traslado" y luego S6 (cita). Preguntó por dos ventas simultáneas: "que sea vea viejo no me preocuopa el tema es que por anda del mundo lo vaya a dejar ahcer al venta y le meustre ele error" → verificado: todo documento salvo T se asigna a la tienda (`documents.service.ts:105`) y POS/COT bloquean inventario con FOR UPDATE antes de contar reservas PV+REM. "pero tambien resta las remsiiones?" → sí. "dale".
