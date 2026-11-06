// Contrato de egresos: GET/POST /egresos, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type {
  AccountsPayableStatus,
  PayableDocumentRef,
  PayableSupplier,
} from './accounts-payable';

export type EgresoPaymentMethod =
  | 'efectivo_almacen'
  | 'consignacion_almacen'
  | 'cheque'
  | 'efectivo_oficina'
  | 'consignacion_oficina';

export interface EgresoListItem {
  id: string;
  number: string;
  date: string;
  total: string;
  cashTotal: string;
  creditTotal: string;
  createdAt: string;
  supplier: PayableSupplier;
}

export interface EgresoListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// GET /egresos
export interface EgresoListResponse {
  items: EgresoListItem[];
  meta: EgresoListMeta;
}

export interface EgresoPaymentLine {
  id: string;
  egresoId: string;
  method: EgresoPaymentMethod;
  amount: string;
  reference: string | null;
  bank: string | null;
  createdAt: string;
}

// Sin supplier, creditApplied ni balance: eso vive a nivel de CxP
export interface EgresoAllocationAccountPayable {
  id: string;
  supplierId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string | null;
  status: AccountsPayableStatus;
  createdAt: string;
  updatedAt: string;
  document: PayableDocumentRef;
}

export interface EgresoAllocation {
  id: string;
  egresoId: string;
  accountPayableId: string;
  // Total abonado a la CxP con este egreso (dinero + saldo a favor)
  amount: string;
  // Parte de `amount` cubierta con saldo a favor (reparto FIFO)
  creditAmount: string;
  accountPayable: EgresoAllocationAccountPayable;
}

// status es texto libre en la BD (available | used): el backend no manda unión
export interface EgresoCredit {
  id: string;
  supplierId: string;
  amount: string;
  balance: string;
  sourceDocumentId: string | null;
  status: string;
  createdAt: string;
  sourceDocument: PayableDocumentRef | null;
}

export interface EgresoCreditApplication {
  id: string;
  supplierCreditId: string;
  accountPayableId: string;
  egresoId: string | null;
  amount: string;
  appliedAt: string;
  supplierCredit: EgresoCredit;
}

// GET /egresos/:id y POST /egresos
export interface Egreso {
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
  supplier: PayableSupplier;
  user: { id: string; name: string };
  payments: EgresoPaymentLine[];
  allocations: EgresoAllocation[];
  creditApplications: EgresoCreditApplication[];
}

// Ordenadas createdAt asc, el mismo orden del reparto FIFO
export interface EgresoOpenPayable {
  id: string;
  supplierId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string | null;
  status: AccountsPayableStatus;
  createdAt: string;
  updatedAt: string;
  document: PayableDocumentRef;
  // Derivado: totalAmount - paidAmount
  balance: string;
}

// GET /egresos/suppliers/:supplierId/open-items
export interface EgresoOpenItems {
  payables: EgresoOpenPayable[];
  credits: EgresoCredit[];
}
