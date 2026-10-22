# Ubicación Colombia (departamento → ciudad)

Tercero y sucursal del cliente guardan su ciudad (DIVIPOLA DANE, solo Colombia); la factura impresa la muestra. Branch `feat/ubicacion-colombia`.
Migración aditiva autorizada por el usuario (2026-10-21). Sin permisos nuevos en el seed RBAC.

## Specs
- S1 — Tablas nuevas `Department` (`departments`: `code` varchar 2 PK, `name`) y `City` (`cities`: `code` varchar 5 PK, `name`, `departmentCode` FK). Datos: `backend/prisma/seeds/DIVIPOLA_Municipios.xlsx` → convertido a JSON y cargado por el seed (idempotente). Usuario: "por ahora solo con colombia" → sin tabla de país.
- S2 — `ThirdParty.cityCode` y `CustomerBranch.cityCode`, opcionales, FK a `cities`. Usuario: "¿La ciudad es obligatoria en el tercero? de momento no". Terceros existentes: "dejalos vacio".
- S3 — API de solo lectura: `GET /locations/departments` (ordenados por nombre) y `GET /locations/departments/:code/cities` (ordenadas por nombre). Crear/editar tercero y sucursal aceptan `cityCode` (código inexistente → 400); en PATCH `''`/`null` lo vacía. Detalle/listado del tercero devuelve `city` con su `department`.
- S4 — Frontend: en el form del tercero y en cada sucursal, selectores **Departamento → Ciudad**; la ciudad solo lista municipios del departamento elegido; cambiar el departamento limpia la ciudad.
- S5 — PDF: debajo de la dirección imprime "Ciudad, Departamento". Usuario: "al momento de imprimir facturas debe tener esa información de geolocalización así mismo" y "cada sucursal tiene su propia ciudad, la factura muestra la ciudad de la sucursal". Si la sucursal no tiene ciudad, se usa la del tercero.

## Tasks
- T1 — JSON desde el Excel + schema + migración manual aditiva + generate + seed (S1, S2). Route: inline. Commit: b54588d ✅
- T2 — Backend: módulo `locations`, DTOs/service de terceros y sucursales, includes de detalle/print, PDF, backend/CLAUDE.md (S3, S5). Route: inline. Commit: 852e82c ✅
- T3 — Frontend: selectores en ThirdPartyForm y sucursales, tipos, frontend/CLAUDE.md (S4). Route: react-code-crafter. Commit: 5024c8a (hecho inline por cuota) ✅
- T4 — Verificación: `pnpm test` + build backend, `tsc` frontend, prueba de API y PDF contra la BD de desarrollo. Route: inline. Commit: — ✅ (falta solo prueba manual en navegador)

## Log
- L1 (usuario, 2026-10-21): "estaba pensando en atacaqr ya el tema de selctor de pais, deparatamento ciudad, como se haria entonces que encesitamos descargar o que?" / "por ahora solo con colombia"
- L2 (usuario): "tambien hay que acalrar que al moemtno de imprimr facturas debe terne esa infomracion de geolocalizacion asi mismo"
- L3 (usuario): "¿La ciudad es obligatoria en el tercero? de momento no / Terceros que ya existen sin ciudad? dejalos vacio / Sucursales del cliente? cda sucrucsal tiene su porpia ciudad , la factura muestra la ciduad de la sucrusal"
- L4 (usuario): "empecemos y dale el ciclo completo ... cuando la terminal empiece a avisar que se va a terminar el uso (~90%), anotás dónde quedamos y en otra sesión retomamos"
- L5 (evidencia, 2026-10-21): backend 208/208 tests + build OK; frontend tsc OK. API: 33 deptos, 125 ciudades de Antioquia, 401 sin token, crear/leer/vaciar cityCode en tercero y sucursal OK, '5001' → 400 "La ciudad no es válida", '99999' → 400 sin cambiar el dato. PDF COT real: sin ciudad / fallback tercero "MEDELLÍN, ANTIOQUIA" / sucursal "SANTIAGO DE CALI, VALLE DEL CAUCA"; datos restaurados. Sin commits (preferencia del usuario). CodeTour: .tours/ubicacion-colombia.tour.
- L6 (usuario, 2026-10-21): "dejemos anotado ahí en este punto y mañana seguimos, o sea yo reviso codetour y te aviso para que comitees y pushees y se lance rdd"
- L7 (estado al cerrar, 2026-10-21): todo sin commit en feat/ubicacion-colombia. Próximo paso: usuario revisa .tours/ubicacion-colombia.tour y prueba en navegador → commit + push → RDD sobre el commit (lentes sugeridas: risk + reliability; el assess de hoy falló como "unassessable" por archivos sin trackear, no fue riesgo medio). Pendientes de decisión: (a) ¿versionar DIVIPOLA_Municipios.xlsx? (recomendado no); (b) ¿agregar gcTime: Infinity en useLocations.ts?
- L7 (usuario, 2026-10-22): revisó el CodeTour ("si ya"); decide no versionar DIVIPOLA_Municipios.xlsx (el seed usa data/divipola.json) y gcTime Infinity en useLocations. Commits b54588d, 852e82c, 5024c8a; push + RDD.
