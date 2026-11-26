// Contrato de recibos de caja: GET/POST /customer-payments, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type {
  AccountsReceivableStatus,
  CustomerCreditKind,
  CustomerCreditUsableIn,
  ReceivableClient,
  ReceivableDocument,
  ReceivableDocumentRef,
} from './accounts-receivable';
import type { TreasuryPaymentMethod } from './supplier-payments';

export type CustomerPaymentDiscountReason =
  | 'descuento_comercial'
  | 'oferta'
  | 'donacion'
  | 'fidelizacion'
  | 'mercancia_extraviada'
  | 'castigo_cartera'
  | 'promocion';

export interface CustomerPaymentBranch {
  id: string;
  name: string;
}

export type CustomerPaymentVoidReason =
  | 'valor_equivocado'
  | 'cliente_equivocado'
  | 'factura_equivocada'
  | 'forma_pago_equivocada'
  | 'pago_duplicado'
  | 'pago_no_recibido'
  | 'otro';

export interface CustomerPaymentListItem {
  id: string;
  number: string;
  date: string;
  total: string;
  // Dinero recibido (= total)
  cashTotal: string;
  // Σ de los saldos a favor aplicados
  creditTotal: string;
  discountAmount: string;
  createdAt: string;
  // Null si el recibo no está anulado
  voidedAt: string | null;
  client: ReceivableClient;
  customerBranch: CustomerPaymentBranch | null;
}

export interface CustomerPaymentListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// GET /customer-payments
export interface CustomerPaymentListResponse {
  items: CustomerPaymentListItem[];
  meta: CustomerPaymentListMeta;
}

// Reusa las formas de pago de egresos (regla de negocio)
export interface CustomerPaymentMethodLine {
  id: string;
  customerPaymentId: string;
  method: TreasuryPaymentMethod;
  amount: string;
  reference: string | null;
  bank: string | null;
  createdAt: string;
}

// Sin client ni balance: eso vive a nivel de CxC
export interface CustomerPaymentAllocationAccountReceivable {
  id: string;
  clientId: string;
  sellerId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  status: AccountsReceivableStatus;
  createdAt: string;
  updatedAt: string;
  document: ReceivableDocumentRef;
}

export interface CustomerPaymentAllocation {
  id: string;
  customerPaymentId: string;
  accountReceivableId: string;
  amount: string;
  // Parte de `amount` cubierta por el descuento del recibo
  discountAmount: string;
  // Parte de `amount` cubierta con saldo a favor; null en recibos anteriores al reparto
  creditAmount: string | null;
  accountReceivable: CustomerPaymentAllocationAccountReceivable;
}

// Tramo de un saldo a favor de administración aplicado a una CxC del recibo
export interface CustomerPaymentCreditApplication {
  id: string;
  amount: string;
  customerCreditId: string;
  // Null en recibos anteriores al reparto
  accountReceivableId: string | null;
  accountReceivable: {
    id: string;
    document: {
      id: string;
      type: ReceivableDocumentRef['type'];
      number: string;
    };
  } | null;
  customerCredit: {
    id: string;
    kind: CustomerCreditKind;
    amount: string;
    // Solo excedentes; una devolución no tiene fecha propia: la UI usa sourceDocument.date
    date: string | null;
    // Null en los excedentes
    sourceDocument: ReceivableDocumentRef | null;
  };
}

// GET /customer-payments/:id, POST /customer-payments y POST /customer-payments/:id/void
export interface CustomerPayment {
  id: string;
  number: string;
  date: string;
  clientId: string;
  customerBranchId: string | null;
  userId: string;
  total: string;
  discountAmount: string;
  discountReason: CustomerPaymentDiscountReason | null;
  // Null en recibos anteriores al campo
  debtBeforeReceipt: string | null;
  notes: string | null;
  idempotencyKey: string;
  createdAt: string;
  // Anulación: null si no está anulado; voidReasonOther solo viene con motivo otro
  voidedAt: string | null;
  voidReason: CustomerPaymentVoidReason | null;
  voidReasonOther: string | null;
  voidedBy: { id: string; name: string } | null;
  client: ReceivableClient;
  customerBranch: CustomerPaymentBranch | null;
  user: { id: string; name: string };
  payments: CustomerPaymentMethodLine[];
  allocations: CustomerPaymentAllocation[];
  creditApplications: CustomerPaymentCreditApplication[];
}

// Ordenadas createdAt asc
export interface CustomerPaymentOpenReceivable {
  id: string;
  clientId: string;
  sellerId: string;
  documentId: string;
  totalAmount: string;
  paidAmount: string;
  status: AccountsReceivableStatus;
  createdAt: string;
  updatedAt: string;
  document: ReceivableDocument;
  // Derivado: totalAmount - paidAmount
  balance: string;
}

// Saldo a favor de administración; en devoluciones `date` es la de su DVV
export interface CustomerPaymentOpenCredit {
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

// GET /customer-payments/clients/:clientId/open-items
export interface CustomerPaymentOpenItems {
  receivables: CustomerPaymentOpenReceivable[];
  credits: CustomerPaymentOpenCredit[];
}
