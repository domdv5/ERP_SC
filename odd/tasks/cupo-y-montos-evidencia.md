# Evidencia: cupo-y-montos

## T1 / PR1 — cupo oculto por rol (backend)

### Qué código revisar
| Nivel | Dónde | Regla | Qué se rompe si está mal |
|---|---|---|---|
| Alto | `backend/src/third-parties/helpers/credit-visibility.ts` (`hideCreditLimit`) | Sin `document.create.COT` ni `customer.credit.update` → `creditLimit: null` | Bodega/Compras/Preventa vuelven a recibir el cupo |
| Alto | `backend/src/third-parties/third-parties.service.ts` `update` | Sin `creditLimit` en el DTO no se toca el cupo guardado | Editar un cliente como Bodega borraría su cupo |
| Medio | `third-parties.service.ts` `findAll`/`findOne`/`create` | Cada respuesta pasa por `hideCreditLimit` | Una de las rutas filtra el cupo |
| Bajo | `third-parties.controller.ts` `findOne` | Pasa `req.user` | Error 500 en el detalle |

### Prueba de que las pruebas sirven
| Mutación | Resultado | Prueba que la atrapó |
|---|---|---|
| `hideCreditLimit` siempre devuelve la entrada | DETECTADA (5 fallos; verificada por el orquestador) | `hideCreditLimit › sin permiso…` + "sin permiso de cupo" en findAll/findOne/create/update |
| Condición de permiso invertida | DETECTADA (15 fallos, reporte del agente) | helper + 4 métodos |
| `update`/`findOne`/`create`/`findAll` sin máscara (una por vez) | DETECTADA (reporte del agente) | "sin permiso de cupo devuelve creditLimit null" de cada método |

Conteos reales (orquestador): `tsc --noEmit` 0 errores; `jest` 68 suites, 708 tests, todos pasan.
Solo con mocks de Prisma: sin base real ni HTTP.
