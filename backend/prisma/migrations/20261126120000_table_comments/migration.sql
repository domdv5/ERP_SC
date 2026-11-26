-- Solo descripciones de tablas (se ven en el cliente de base de datos); no cambia datos ni estructura.

-- Maestros
COMMENT ON TABLE "gender" IS 'Género del producto (dama, caballero, niño…), parte del código del producto';
COMMENT ON TABLE "category" IS 'Categoría del producto (jean, blusa, calzado…), parte del código del producto';
COMMENT ON TABLE "brand" IS 'Marca de producto; cada marca pertenece a un proveedor';
COMMENT ON TABLE "product" IS 'Producto que se compra y se vende, con su precio y costo promedio';
COMMENT ON TABLE "third_parties" IS 'Tercero: persona o empresa (cliente, proveedor y/o vendedor)';
COMMENT ON TABLE "customers" IS 'Datos de cliente de un tercero (cupo de crédito, descuento, vendedor)';
COMMENT ON TABLE "customer_branch" IS 'Sucursal de un cliente';
COMMENT ON TABLE "suppliers" IS 'Datos de proveedor de un tercero';
COMMENT ON TABLE "departments" IS 'Departamentos de Colombia';
COMMENT ON TABLE "cities" IS 'Ciudades de Colombia, por departamento';

-- Bodegas e inventario
COMMENT ON TABLE "warehouse" IS 'Bodega o tienda física';
COMMENT ON TABLE "zone" IS 'Zona dentro de una bodega';
COMMENT ON TABLE "bin" IS 'Ubicación (estante) dentro de una zona';
COMMENT ON TABLE "inventory" IS 'Stock total de cada producto por bodega';
COMMENT ON TABLE "bin_stock" IS 'Stock de cada producto por ubicación; su suma por bodega debe ser igual a inventory';
COMMENT ON TABLE "inventory_movements" IS 'Kardex: cada entrada o salida de stock, con su documento';
COMMENT ON TABLE "inventory_snapshot" IS 'Foto del stock por fecha (diaria, semanal o mensual) para informes';
COMMENT ON TABLE "inventory_case" IS 'Caso de diferencia de inventario abierto por un ajuste, hasta encontrar la causa';
COMMENT ON TABLE "reservation_release" IS 'Historial de cantidades liberadas de una preventa o remisión';

-- Documentos
COMMENT ON TABLE "document" IS 'Documento: venta, compra, devolución, ajuste, traslado, preventa, remisión…';
COMMENT ON TABLE "document_item" IS 'Líneas (productos) de un documento';
COMMENT ON TABLE "document_payment" IS 'Formas de pago de una venta (efectivo, consignación, crédito)';
COMMENT ON TABLE "sequence" IS 'Último consecutivo usado por cada tipo de documento';

-- Cartera
COMMENT ON TABLE "accounts_receivable" IS 'Cuenta por cobrar: lo que un cliente debe por una venta a crédito';
COMMENT ON TABLE "accounts_payable" IS 'Cuenta por pagar: lo que se le debe a un proveedor por una compra';
COMMENT ON TABLE "customer_credit" IS 'Saldo a favor del cliente (por devolución o excedente de pago)';
COMMENT ON TABLE "customer_credit_application" IS 'Uso de un saldo a favor del cliente en una venta o recibo de caja';
COMMENT ON TABLE "supplier_credit" IS 'Saldo a favor con un proveedor (nota crédito por devolución)';
COMMENT ON TABLE "supplier_credit_application" IS 'Uso de un saldo a favor con proveedor en un egreso';

-- Tesorería
COMMENT ON TABLE "recibo_caja" IS 'Recibo de caja: pago de un cliente a sus cuentas por cobrar';
COMMENT ON TABLE "recibo_caja_payment" IS 'Formas de pago con que el cliente pagó un recibo de caja';
COMMENT ON TABLE "recibo_caja_allocation" IS 'Cuánto abonó un recibo de caja a cada cuenta por cobrar';
COMMENT ON TABLE "egreso" IS 'Egreso: pago a un proveedor de sus cuentas por pagar';
COMMENT ON TABLE "egreso_payment" IS 'Formas de pago con que se pagó un egreso';
COMMENT ON TABLE "egreso_allocation" IS 'Cuánto abonó un egreso a cada cuenta por pagar';

-- Usuarios y sistema
COMMENT ON TABLE "user" IS 'Usuario que entra al sistema';
COMMENT ON TABLE "role" IS 'Rol de usuario (admin, facturación, bodega…)';
COMMENT ON TABLE "permission" IS 'Permiso que se le puede dar a un rol';
COMMENT ON TABLE "role_permission" IS 'Qué permisos tiene cada rol';
COMMENT ON TABLE "user_role" IS 'Qué roles tiene cada usuario';
COMMENT ON TABLE "system_config" IS 'Configuración general del sistema (modo solo lectura)';
