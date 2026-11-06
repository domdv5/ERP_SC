// Contrato de recibos de caja: GET/POST /recibos-caja, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type {
  AccountsReceivableStatus,
  CustomerCreditKind,
  CustomerCreditUsableIn,
  ReceivableClient,
  ReceivableDocument,
  ReceivableDocumentRef,
} from './accounts-receivable';
import type { EgresoPaymentMethod } from './egresos';

export type ReciboCajaDiscountReason =
  | 'descuento_comercial'
  | 'oferta'
  | 'donacion'
  | 'fidelizacion'
  | 'mercancia_extraviada'
  | 'castigo_cartera'
  | 'promocion';

export interface ReciboCajaBranch {
  id: string;
  name: string;
}

export interface ReciboCajaListItem {
  id: string;
  number: string;
  date: string;
  total: string;
  createdAt: string;
  client: ReceivableClient;
  customerBranch: ReciboCajaBranch | null;
}

export interface ReciboCajaListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// GET /recibos-caja
export interface ReciboCajaListResponse {
  items: ReciboCajaListItem[];
  meta: ReciboCajaListMeta;
}

// Reusa las formas de pago de egresos (regla de negocio)
export interface ReciboCajaPaymentLine {
  id: string;
  reciboCajaId: string;
  method: EgresoPaymentMethod;
  amount: string;
  reference: string | null;
  bank: string | null;
  createdAt: string;
}

// Sin client ni balance: eso vive a nivel de CxC
export interface ReciboCajaAllocationAccountReceivable {
  id: string;
  clientId: string;
  sellerId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string | null;
  status: AccountsReceivableStatus;
  createdAt: string;
  updatedAt: string;
  document: ReceivableDocumentRef;
}

export interface ReciboCajaAllocation {
  id: string;
  reciboCajaId: string;
  accountReceivableId: string;
  amount: string;
  // Parte de `amount` cubierta por el descuento del recibo
  discountAmount: string;
  accountReceivable: ReciboCajaAllocationAccountReceivable;
}

// Saldo a favor de administración usado como parte del pago; date es null si no es excedente
export interface ReciboCajaCreditApplication {
  id: string;
  amount: string;
  customerCreditId: string;
  customerCredit: { id: string; date: string | null; amount: string };
}

// GET /recibos-caja/:id y POST /recibos-caja
export interface ReciboCaja {
  id: string;
  number: string;
  date: string;
  clientId: string;
  customerBranchId: string | null;
  userId: string;
  total: string;
  discountAmount: string;
  discountReason: ReciboCajaDiscountReason | null;
  // Null en recibos anteriores al campo
  debtBeforeReceipt: string | null;
  notes: string | null;
  idempotencyKey: string;
  createdAt: string;
  client: ReceivableClient;
  customerBranch: ReciboCajaBranch | null;
  user: { id: string; name: string };
  payments: ReciboCajaPaymentLine[];
  allocations: ReciboCajaAllocation[];
  creditApplications: ReciboCajaCreditApplication[];
}

// Ordenadas createdAt asc
export interface ReciboCajaOpenReceivable {
  id: string;
  clientId: string;
  sellerId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string | null;
  status: AccountsReceivableStatus;
  createdAt: string;
  updatedAt: string;
  document: ReceivableDocument;
  // Derivado: totalAmount - paidAmount
  balance: string;
}

// Saldo a favor de administración; en devoluciones `date` es la de su DVV
export interface ReciboCajaOpenCredit {
  id: string;
  amount: string;
  balance: string;
  date: string;
  kind: CustomerCreditKind;
  usableIn: CustomerCreditUsableIn;
  customerBranchId: string | null;
  // Null en los excedentes
  sourceDocument: ReceivableDocumentRef | null;
}

// GET /recibos-caja/clients/:clientId/open-items
export interface ReciboCajaOpenItems {
  receivables: ReciboCajaOpenReceivable[];
  credits: ReciboCajaOpenCredit[];
}
