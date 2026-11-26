// Contrato de pagos a proveedor (egreso): GET/POST /supplier-payments, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type {
  AccountsPayableStatus,
  PayableDocumentRef,
  PayableSupplier,
} from './accounts-payable';

export type TreasuryPaymentMethod =
  | 'efectivo_almacen'
  | 'consignacion_almacen'
  | 'cheque'
  | 'efectivo_oficina'
  | 'consignacion_oficina';

export interface SupplierPaymentListItem {
  id: string;
  number: string;
  date: string;
  total: string;
  cashTotal: string;
  creditTotal: string;
  createdAt: string;
  // Null si el egreso no está anulado
  voidedAt: string | null;
  supplier: PayableSupplier;
}

export interface SupplierPaymentListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// GET /supplier-payments
export interface SupplierPaymentListResponse {
  items: SupplierPaymentListItem[];
  meta: SupplierPaymentListMeta;
}

export interface SupplierPaymentMethodLine {
  id: string;
  supplierPaymentId: string;
  method: TreasuryPaymentMethod;
  amount: string;
  reference: string | null;
  bank: string | null;
  createdAt: string;
}

// Sin supplier, creditApplied ni balance: eso vive a nivel de CxP
export interface SupplierPaymentAllocationAccountPayable {
  id: string;
  supplierId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  status: AccountsPayableStatus;
  createdAt: string;
  updatedAt: string;
  document: PayableDocumentRef;
}

export interface SupplierPaymentAllocation {
  id: string;
  supplierPaymentId: string;
  accountPayableId: string;
  // Total abonado a la CxP con este egreso (dinero + saldo a favor)
  amount: string;
  // Parte de `amount` cubierta con saldo a favor (reparto FIFO)
  creditAmount: string;
  accountPayable: SupplierPaymentAllocationAccountPayable;
}

// status es texto libre en la BD (available | used): el backend no manda unión
export interface SupplierPaymentCredit {
  id: string;
  supplierId: string;
  amount: string;
  balance: string;
  sourceDocumentId: string | null;
  status: string;
  createdAt: string;
  sourceDocument: PayableDocumentRef | null;
}

export interface SupplierPaymentCreditApplication {
  id: string;
  supplierCreditId: string;
  accountPayableId: string;
  supplierPaymentId: string | null;
  amount: string;
  appliedAt: string;
  accountPayable: { id: string; document: PayableDocumentRef };
  supplierCredit: SupplierPaymentCredit;
}

export type SupplierPaymentVoidReason =
  | 'valor_equivocado'
  | 'proveedor_equivocado'
  | 'factura_equivocada'
  | 'forma_pago_equivocada'
  | 'pago_duplicado'
  | 'pago_no_realizado'
  | 'otro';

// GET /supplier-payments/:id, POST /supplier-payments y POST /supplier-payments/:id/void
export interface SupplierPayment {
  id: string;
  number: string;
  date: string;
  supplierId: string;
  userId: string;
  total: string;
  cashTotal: string;
  creditTotal: string;
  notes: string | null;
  idempotencyKey: string;
  createdAt: string;
  // Anulación: null si no está anulado; voidReasonOther solo viene con motivo otro
  voidedAt: string | null;
  voidReason: SupplierPaymentVoidReason | null;
  voidReasonOther: string | null;
  voidedBy: { id: string; name: string } | null;
  supplier: PayableSupplier;
  user: { id: string; name: string };
  payments: SupplierPaymentMethodLine[];
  allocations: SupplierPaymentAllocation[];
  creditApplications: SupplierPaymentCreditApplication[];
}

// Ordenadas createdAt asc, el mismo orden del reparto FIFO
export interface SupplierPaymentOpenPayable {
  id: string;
  supplierId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  status: AccountsPayableStatus;
  createdAt: string;
  updatedAt: string;
  document: PayableDocumentRef;
  // Derivado: totalAmount - paidAmount
  balance: string;
}

// GET /supplier-payments/suppliers/:supplierId/open-items
export interface SupplierPaymentOpenItems {
  payables: SupplierPaymentOpenPayable[];
  credits: SupplierPaymentCredit[];
}
