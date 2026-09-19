---
name: project-warehouses-subentities
description: Decisión de arquitectura para Zones y Bins dentro del módulo Warehouses (controllers anidados, un solo módulo)
metadata:
  type: project
---

Zones y Bins se estructuran como sub-carpetas dentro de `backend/src/warehouses/` (Opción A): un controller + service por entidad (`zones/zones.controller.ts`, `zones/zones.service.ts`, `bins/bins.controller.ts`, `bins/bins.service.ts`), todos registrados en el mismo `WarehousesModule`. No se crean `ZonesModule`/`BinsModule` independientes.

**Why:** Warehouse es el aggregate root (DDD); Zone y Bin son entidades internas del agregado — no tienen recurso raíz propio (`/zones`, `/bins` no existen, siempre cuelgan de un warehouse). Módulos independientes serían fragmentación prematura (un solo consumidor). Meter todo en un controller violaría SRP (~12 endpoints, 3 niveles de anidación mezclados).

**How to apply:**
- Rutas anidadas: el prefijo completo va en `@Controller('warehouses/:warehouseId/zones')` y `@Controller('warehouses/:warehouseId/zones/:zoneId/bins')`. NestJS no tiene "router anidado"; cada controller declara su prefijo completo. No usar `RouterModule`.
- `warehouseId`/`zoneId` viajan solo en la URL (`@Param`), nunca en el body del DTO.
- Validación de jerarquía obligatoria en el service antes de cualquier escritura (`findFirst({ where: { id, warehouseId } })` → `NotFoundException` en español). Sin esto un usuario podría editar zona de otro warehouse.
- Permiso único `warehouse.manage` cubre todas las escrituras de zones/bins (coherente con CLAUDE.md). No namespacear a `warehouse.zone.manage` salvo que el negocio lo exija.
- Soft-delete (`active: false`) para zones/bins igual que warehouses, porque Bin/InventoryMovement pueden referenciarlas.
- Convención de nombres de DTO: `create-zone.dto.ts` / `update-zone.dto.ts` (los archivos actuales `create-zone-dto.ts` y `update-zone-dtos.ts` rompen la convención `create-warehouse.dto.ts` — renombrar).
- **Colocación de DTOs por submódulo (recomendado):** los DTOs de Zone viven en `zones/dto/` y los de Bin en `bins/dto/`, cada uno con su propio `index.ts`. En `warehouses/dto/` quedan solo los DTOs de Warehouse. Razón: principio de co-ubicación por feature — `zones/` y `bins/` ya tienen controller+service propios, así que sus contratos deben acompañarlos; mantenerlos planos en `warehouses/dto/` crea asimetría y un cajón de sastre cuando crecen. El tradeoff es co-ubicación/cohesión (escala mejor, submódulo movible/eliminable autónomamente) vs. centralización (un solo barrel, cómodo solo mientras el módulo es chico). Aggregate root gobierna acceso/consistencia vía el root (warehouseId/zoneId en URL + validación en service del padre), NO obliga a una carpeta plana — la estructura física es independiente de la regla de agregación. Si el módulo aún es muy pequeño, dejarlo centralizado es defendible como decisión consciente, pero reubicar en cuanto Zone o Bin sume un 3er DTO.
