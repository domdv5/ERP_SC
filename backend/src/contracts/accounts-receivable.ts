// Contrato de cuentas por cobrar: GET /accounts-receivable y los excedentes, tal como viajan en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type { DocumentType } from './documents';

export type AccountsReceivableStatus = 'pending' | 'partial' | 'paid';

export type ReceivableClientsStatus = 'with_balance' | 'settled';

export type ReceivableClientsSort = 'recent' | 'oldest_debt';

export type CustomerCreditKind = 'devolucion' | 'excedente';

export type CustomerCreditUsableIn = 'facturacion' | 'administracion';

export interface ReceivableDocumentRef {
  id: string;
  type: DocumentType;
  number: string;
  date: string;
}

export interface ReceivableDocument extends ReceivableDocumentRef {
  customerBranch: { id: string; name: string } | null;
}

export interface ReceivableClient {
  id: string;
  thirdParty: { id: string; name: string };
}

export interface AccountsReceivable {
  id: string;
  clientId: string;
  sellerId: string;
  documentId: string;
  totalAmount: string;
  dueDate: string | null;
  status: AccountsReceivableStatus;
  createdAt: string;
  updatedAt: string;
  client: ReceivableClient;
  seller: { id: string; name: string };
  document: ReceivableDocument;
  paidAmount: string;
  // Derivado: totalAmount - paidAmount
  balance: string;
  lastPaymentDate: string | null;
  paymentDays: number;
  isPaymentOpen: boolean;
}

export type AccountsReceivableHistoryEntry =
  | {
      source: 'recibo_caja';
      date: string;
      amount: string;
      // Parte de `amount` cubierta por el descuento del recibo
      discountAmount: string;
      reciboCaja: { id: string; number: string; date: string };
    }
  | {
      source: 'pago_historico';
      date: string;
      amount: string;
      paymentMethod: string;
      reference: string | null;
    };

// GET /accounts-receivable/:id (sin los pagos crudos: van resumidos en history)
export interface AccountsReceivableDetail extends Omit<
  AccountsReceivable,
  'lastPaymentDate' | 'paymentDays' | 'isPaymentOpen'
> {
  history: AccountsReceivableHistoryEntry[];
}

// Suma sobre todo el conjunto filtrado, no solo la página
export interface AccountsReceivableTotals {
  totalAmount: string;
  paidAmount: string;
  balance: string;
}

export interface AccountsReceivableListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totals: AccountsReceivableTotals;
}

// GET /accounts-receivable
export interface AccountsReceivableListResponse {
  items: AccountsReceivable[];
  meta: AccountsReceivableListMeta;
}

export interface ReceivableClientSummary {
  client: { id: string; name: string };
  receivableCount: number;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  lastSaleDate: string;
  lastPaymentDate: string | null;
  lastMovementAt: string;
  // Días desde la factura más antigua con saldo; null si no debe nada
  oldestPendingDays: number | null;
}

// GET /accounts-receivable/clients
export interface ReceivableClientsResponse {
  items: ReceivableClientSummary[];
  meta: AccountsReceivableListMeta;
}

export interface ClientStatementTotals {
  totalDebt: string;
  totalPaid: string;
  totalBalance: string;
  // Solo saldos de facturación (devoluciones)
  availableCredit: string;
  // Solo saldos de administración (excedentes y devoluciones de administración)
  availableBranchCredit: string;
}

// branchId null = CxC sin sucursal; siempre sobre todas las CxC del cliente
export interface ClientBranchTotal {
  branchId: string | null;
  name: string;
  totalDebt: string;
  totalPaid: string;
  totalBalance: string;
  availableBranchCredit: string;
}

// Una aplicación va a una venta (devolución) o a un recibo de caja (excedente)
export interface ClientCreditApplication {
  id: string;
  customerCreditId: string;
  saleDocumentId: string | null;
  reciboCajaId: string | null;
  amount: string;
  appliedAt: string;
  saleDocument: ReceivableDocumentRef | null;
  reciboCaja: { id: string; number: string; date: string } | null;
}

// status es texto libre en la BD (available | used | voided): el backend no manda unión
export interface CustomerCreditRecord {
  id: string;
  customerId: string;
  kind: CustomerCreditKind;
  usableIn: CustomerCreditUsableIn;
  customerBranchId: string | null;
  date: string | null;
  userId: string | null;
  voidedAt: string | null;
  voidedById: string | null;
  amount: string;
  balance: string;
  sourceDocumentId: string | null;
  status: string;
  createdAt: string;
}

export interface ClientCredit extends CustomerCreditRecord {
  customerBranch: { id: string; name: string } | null;
  user: { id: string; name: string } | null;
  voidedBy: { id: string; name: string } | null;
  sourceDocument: ReceivableDocumentRef | null;
  applications: ClientCreditApplication[];
}

// GET /accounts-receivable/clients/:clientId/statement
export interface ClientStatement {
  client: { id: string; name: string };
  totals: ClientStatementTotals;
  branchTotals: ClientBranchTotal[];
  receivables: AccountsReceivable[];
  credits: ClientCredit[];
}

// POST /accounts-receivable/clients/:clientId/excedentes y PATCH /accounts-receivable/excedentes/:id/void
export type Excedente = CustomerCreditRecord;
