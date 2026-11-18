# Consulta de saldos a favor

Módulo de solo consulta para buscar clientes y proveedores por nombre o documento y ver sus saldos a favor con su estado actual.
Rama `feat/consulta-saldos-a-favor`. No cambia dinero, base de datos ni permisos sembrados.

## Specs

- **S1** — Petición: "Necesito esto ya es una funcinalidad y seria cmo un uenvo moudlo o algo asi dodne yo peuda consultar por nombre o dcuemnto los saldos a favor que tiene ese cleinte o proveedor, y pueda ver sue stad actual, porque no existe una ehrramenite actual que sea de consulta de ese tipo,"
- **S2** — Menú: grupo Finanzas → "Saldos a favor". Dos pestañas: Clientes | Proveedores.
- **S3** — Lista por tercero con buscador por **nombre o número de documento**. Columnas: tercero, documento, cantidad de saldos, total disponible. Filtro "Solo con saldo disponible" activo por defecto; apagado muestra también terceros cuyos saldos ya se usaron o anularon. Paginada.
- **S4** — Detalle del tercero: cada saldo a favor con origen (DVV-…, Excedente, DVC-…), fecha, valor original, usado, disponible y estado: **Disponible** (sin usar), **Usado en parte** (0 < disponible < original), **Usado** (disponible 0), **Anulado** (en gris). Cada saldo despliega dónde se usó (documento, valor, fecha: POS/COT, RC, EG…). En clientes además sucursal y si es usable en facturación o administración.
- **S5** — "Total disponible" suma solo saldos no anulados con disponible > 0.
- **S6** — Permisos: pestaña Clientes con `ar.read`, Proveedores con `ap.read` (hoy admin y accounts_admin). Sin cambios al seed. Sin permiso → 403 y la opción no aparece en el menú.
- **S7** — Solo consulta: **no** vuelve el botón "Anular" de excedentes (el dueño planea otra vista; el endpoint de anular queda como está).

## Tasks

- [x] **T1** (S3-S6) backend: endpoints de lista y detalle, contrato, pruebas — route `nestjs-code-crafter` — commit: ver git log (backend credits)
- [ ] **T2** (S2-S5, S7) frontend: menú, lista con pestañas y búsqueda, detalle — route `react-code-crafter` — commit: —
- [ ] **T3** verificación con base real y pantalla — route parent — commit: —

## Log

- **L1** (2026-11-18) Pedido original: ver S1. Contexto: el 2026-11-17 el dueño pidió sacar la tabla de saldos a favor del detalle de CxP/CxC "ya que se va a necesitar un modulo aparte donde se consulte por cliente y por proveedor esos saldos a favor".
- **L2** El dueño: "el backend ya hay una parte hecha porque en cun4etas por apgar y cobrar lo msotrabab".
- **L3** Respuestas a la propuesta: "En el primer punto punto dejemos por ahora solo admin ya dminsitradora de ceuntas / no me convece porque este es solo de consulta ademas para eso estoy pensando en tora vista dejemos el back preaparado cmomo ya esta / si" → permisos ar.read/ap.read (S6), sin botón anular (S7), anulados visibles en gris (S4).
- **L4** T1: jest 746/746, tsc 0. API real: /credits/customers?onlyAvailable=true lista con total disponible; búsqueda por documento 900888030 encuentra Cadena Prueba 30 Sucursales; /credits/suppliers/<Industrias Bogotá> muestra DVC-000019 500.000 available sin usos (los usos de EG anulados no aparecen). creditCount cuenta todos los saldos del tercero.
