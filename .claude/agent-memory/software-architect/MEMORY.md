# Memory Index

- [Warehouses sub-entities (Zones/Bins)](project_warehouses_subentities.md) — Controllers anidados en un solo WarehousesModule; warehouseId/zoneId solo en URL; validación de jerarquía en service; warehouse.manage cubre todo
- [Credit tables stay split](project_credit_tables_split.md) — CustomerCredit/SupplierCredit NO se unifican; la tabla de applications (AP vs AR) es lo que lo bloquea; plan de simetría para fase ventas
- [Preventa (PV) reserva derivada](project_preventa_reservation_design.md) — reservado se DERIVA de items PV confirmados, sin tabla StockReservation; el argumento es que void() queda intacto (pendiente aprobación)
