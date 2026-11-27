# Módulo de excedentes (clientes y proveedores)

Registrar excedentes en un módulo propio (Tesorería → Excedentes, diseño `design/excedentes-modulo/01-lista-panel.html`), único lugar de registro, para clientes y proveedores.
Rama `feat/excesses-module`. Riesgo alto: migración, dinero, consecutivo.

## Specs

- **S1** Módulo propio: "estaba pensando merjo en un modulo donde se peuda registrar esos exdentes y quitarlos de donde se ahce actualmente". Diseño elegido: 01 (lista con pestañas Clientes/Proveedores + panel lateral "Registrar excedente").
- **S2** "Solo se peude registrar excdentes a roles de tipo cliente o proveedor": cliente → `ThirdParty.isCustomer`; proveedor → `ThirdParty.isSupplier`. Otro tercero → rechazo sin crear nada.
- **S3** "Se peude anular": solo si nunca se usó (sin aplicaciones vigentes y `balance = amount`); queda marcado `voided`, no se borra. Motivo obligatorio de lista: `valor_mal_digitado` ("Valor mal digitado"), `tercero_equivocado` ("Tercero equivocado"), `otro` ("Otro", con texto obligatorio, máx. 500).
- **S4** "quede el valor del excdente y la fecha": valor > 0 (pesos, 2 decimales) y fecha (default hoy Bogotá, nunca futura).
- **S5** "une staod de dicho excdente (usado, disponible)": estados `available` (Disponible), `used` (Usado, con el recibo/egreso donde se usó) y `voided` (Anulado).
- **S6** "El excedente se usa todo o no se usa": regla ya vigente en recibos y egresos; se mantiene y se prueba para excedentes de proveedor en egresos.
- **S7** "Que respete coherencia enc uanto de quien es y que solo ese quien lopueda usar tanto en clionet con sucursulaes o no, como en provvedores": excedente de cliente solo en recibos de ese cliente y de su sucursal (null = CxC sin sucursal; la sucursal debe ser del cliente); excedente de proveedor solo en egresos de ese proveedor.
- **S8** "eso si que sea el unico lugar donde se peuden registrar excdentes!": se elimina `POST /accounts-receivable/clients/:clientId/excedentes`, `PATCH /accounts-receivable/excedentes/:id/void` y el botón/modal del estado de cuenta del cliente.
- **S9** Consecutivo propio `EXC` (decisión del dueño): uno solo compartido por clientes y proveedores (`SequenceService`, clave `EXCESS`); los excedentes de cliente ya existentes se numeran en la migración por fecha.
- **S10** Permisos (decisión del dueño): `excedente.create` para listar, registrar y anular, ambos tipos. Sin cambios al seed RBAC. "solo admin ya dminsirtadore de cuenta pueden hacer eso": `excedente.create` ya está solo en `admin` y `accounts_admin` (`role-permissions.seed.ts:72,158`).

## Tasks

| ID | Specs | Ruta | Commit |
|---|---|---|---|
| T1 | S3, S9 | Migración + schema (inline) | d932641 |
| T2 | S1-S5, S7-S10 | Backend módulo `excesses` (service inline + nestjs-code-crafter) | d4197c0 |
| T3 | S6, S7 | Egresos: excedentes de proveedor (nestjs-code-crafter, pruebas) | d4197c0 |
| T4 | S1, S5, S8 | Frontend diseño 01 + quitar modal viejo (react-code-crafter) | 53c6e72 |
| T5 | todas | Docs, mutaciones, verificación dev | 85b98ee, 8577a88 |
| T6 | S5, S7 | JD hallazgos 1-6: no registrar mientras cargan/fallan sucursales; EXC en el egreso; invalidaciones cruzadas; panel sigue la pestaña; idempotencia POST /excesses (migración); buscar "EXC-000012" | 4531227 |
| T7 | S3, S4, S5 | JD hallazgos 7-9: filtro Disponible sin "Usado en parte" (+ filtro propio); CHECK fecha/usuario/sin documento en excedente de proveedor; tope de valor | 37a4759 |

## Log

- **L1** (2026-11-27, pedido original): "mira algo que quiero cambiar es el tema de los excdentes, pero no su funciomaniemto sino en donde se registran, tanto un excedente de un proveedor o de un cliente, pero registrarlo desde el egreo o cuenta por apgar es atinatural, entonces estaba pensando merjo en un modulo donde se peuda registrar esos exdentes y quitarlos de donde se ahce actualmente obivmanete siguiendo las sigueinte reglas:? haz un canva 1- Solo se peude registrar excdentes a roles de tipo cliente o proveedor 2- Se peude anular 3- quede el valor del excdente y la fecha 4- une staod de dicho excdente (usado, disponible) 5- El excedente se usa todo o no se usa 6- Que respete coherencia enc uanto de quien es y que solo ese quien lopueda usar tanto en clionet con sucursulaes o no, como en provvedores"
- **L2** Hallazgo: hoy el excedente de cliente se registra desde el estado de cuenta del cliente (CxC); el de proveedor no existe (solo notas DVC).
- **L3** Diseño: "el primero me gusta mas!" → 01-lista-panel.
- **L4** Decisiones: consecutivo EXC sí; motivo de anulación de lista sí; permisos = `excedente.create` para ambos.
- **L5** "eso si que sea el unico lugar donde se peuden registrar excdentes!"
- **L6** "dale" al plan.
- **L7** "solo admin ya dminsirtadore de cuenta pueden hacer eso" → verificado: `excedente.create` solo en admin y accounts_admin.
- **L8** T4 (react-code-crafter): `src/pages/excesses/*`, ruta `/excesses`, menú Tesorería; quitado el modal viejo del estado de cuenta **y también de `CustomerPaymentNewPage`** (segundo lugar de registro). tsc ok, vitest 251/251, build ok. Sin prueba en pantalla.
- **L9** T2/T3 (nestjs-code-crafter): módulo `/excesses`, borradas las rutas viejas, `credits.service` muestra el origen excedente de proveedor y deja fuera los anulados; el egreso ya cumplía las reglas (solo se agregaron pruebas). tsc ok, jest 838/838.
- **L10** Verificación: E2E API 25/25 PASS, 9/9 mutaciones DETECTADAS (ver `excesses-module-evidencia.md`). Corte de commits: 8049fb5 (BD), 173f5cc (backend), af3dbef (frontend).
- **L11** Verificador: S1-S10 PASS. Arreglo de usos repetidos (dc62549). Pantalla verificada con Playwright.
- **L12** Judgment Day (dos jueces): APPROVED, sin BLOCKER/CRITICAL; verificación final jest 839/839, vitest 251/251 sobre 949cd2f. Hallazgos informativos 1-9 (ver resumen al dueño).
- **L13** Dueño: "puede ser 1 y 6 en un commit y el resto en otro no?" + "osea me refiere del 1 al 6" → T6 = hallazgos 1-6 (un commit), T7 = 7-9 (otro commit).
- **L14** T6 commit 173459f: E2E 9/9, pantalla 4/4, mutaciones 8/8. T7: E2E 4/4, CHECK probado en base real, mutaciones 3/3.
- **L15** RDD por tramos (dueño: "como lanzamod RDD de toda la funcionaldiad como tal?" → "dale"). El tramo 1 quedó escalado porque el commit de BD arrastraba los borrados de los archivos viejos. Se reordenó la rama con commit-tree (el árbol final quedó idéntico; respaldo en backup/excesses-before-rebase). Resultado: d932641+d4197c0 (BD + backend) APROBADO; 53c6e72 (frontend) APROBADO; 2d85c10..529d537 (fix + docs) no requería revisión (riesgo medio); 4531227+37a4759 (hallazgos JD) APROBADO.
- **L16** Dueño: buscar la clave de idempotencia solo en la tabla del tipo ("entonces hagamoslo!"). Un reintento llega con el mismo tipo y la pantalla regenera la clave al cambiarlo; una colisión de UUID es despreciable.
- **L17** Judgment Day 2 (529d537..8819630): APPROVED, sin BLOCKER/CRITICAL; verificación final jest 878/878 y vitest 259/259 sobre 70de438. Hallazgo confirmado contra la base real: con 8 envíos simultáneos con la misma clave, 1 recibe el excedente y 7 reciben el 409 genérico «Ya existe un registro con ese valor», porque el P2002 de adapter-pg no trae meta.target. No se duplican datos. El mismo patrón está en recibos, egresos y documentos. Dueño: "dejemsolo asi" (pendiente menor, no se arregla).
