---
name: dbhub-live-db
description: El MCP dbhub (mcp__dbhub__execute_sql) apunta a la misma base erp_db que usa el backend en :3000 — sirve para verificar invariantes en vivo durante una auditoría
metadata:
  type: reference
---

`mcp__dbhub__execute_sql` está conectado a `erp_db`, **la misma base que usa el backend corriendo en `localhost:3000`**. No es una copia ni un sandbox aparte.

Para qué sirve en una auditoría: después de disparar peticiones con curl, se puede confirmar el efecto real en las tablas (por ejemplo que `accounts_payable.paid_amount` nunca supere `total_amount`, que no haya huecos en `sequence` vs `MAX(number)`, o que `egreso.total` cuadre con la suma de sus `egreso_allocation`). Es mucho más barato que deducirlo desde las respuestas de la API.

Cuidado: al ser la base real del entorno de pruebas compartido, cualquier `UPDATE`/`DELETE` afecta lo que ven las otras sesiones. Usarla solo para lectura salvo que el usuario pida lo contrario. Ver [[test-environment-not-production]] para el contexto de que es data de prueba.
