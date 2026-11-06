// Contrato de cuentas por pagar: GET /accounts-payable, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type { DocumentType } from './documents';

export type AccountsPayableStatus = 'pending' | 'partial' | 'paid';

export type PayableSuppliersStatus = 'with_balance' | 'settled';

export type PayableSuppliersSort = 'recent' | 'oldest_debt';

export interface PayableDocumentRef {
  id: string;
  type: DocumentType;
  number: string;
  date: string;
}

// receiver es null en compras anteriores al campo "Recibido por"
export interface PayableDocument extends PayableDocumentRef {
  receiver: { id: string; name: string } | null;
}

export interface PayableSupplier {
  id: string;
  internalNumber: number;
  discountNotes: string | null;
  thirdParty: { id: string; name: string };
}

export interface AccountsPayable {
  id: string;
  supplierId: string;
  documentId: string;
  totalAmount: string;
  dueDate: string | null;
  status: AccountsPayableStatus;
  createdAt: string;
  updatedAt: string;
  supplier: PayableSupplier;
  document: PayableDocument;
  // Dinero + saldo a favor ya aplicados
  paidAmount: string;
  creditApplied: string;
  // Derivado: totalAmount - paidAmount
  balance: string;
}

export type AccountsPayableHistoryEntry =
  | {
      source: 'egreso';
      date: string;
      amount: string;
      creditAmount: string;
      egreso: { id: string; number: string; date: string };
    }
  | {
      source: 'pago_historico';
      date: string;
      amount: string;
      paymentMethod: string;
      bankDestination: string | null;
      reference: string | null;
    }
  | {
      source: 'nota_credito_historica';
      date: string;
      amount: string;
      supplierCredit: { id: string; amount: string; balance: string };
    };

// GET /accounts-payable/:id
export interface AccountsPayableDetail extends AccountsPayable {
  history: AccountsPayableHistoryEntry[];
}

// Suma sobre todo el conjunto filtrado, no solo la página
export interface AccountsPayableTotals {
  totalAmount: string;
  paidAmount: string;
  balance: string;
}

export interface AccountsPayableListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totals: AccountsPayableTotals;
}

// GET /accounts-payable
export interface AccountsPayableListResponse {
  items: AccountsPayable[];
  meta: AccountsPayableListMeta;
}

export interface PayableSupplierSummary {
  supplier: { id: string; name: string };
  payableCount: number;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  lastPurchaseDate: string;
  lastPaymentDate: string | null;
  lastMovementAt: string;
  // Días desde la factura más antigua con saldo; null si no se le debe nada
  oldestPendingDays: number | null;
}

// GET /accounts-payable/suppliers
export interface PayableSuppliersResponse {
  items: PayableSupplierSummary[];
  meta: AccountsPayableListMeta;
}

// GET /accounts-payable/credits; status es texto libre en la BD (available | used): el backend no manda unión
export interface SupplierCredit {
  id: string;
  supplierId: string;
  amount: string;
  balance: string;
  sourceDocumentId: string | null;
  status: string;
  createdAt: string;
}

export interface SupplierCreditApplication {
  id: string;
  supplierCreditId: string;
  accountPayableId: string;
  egresoId: string | null;
  amount: string;
  appliedAt: string;
  egreso: { id: string; number: string; date: string } | null;
}

export interface SupplierCreditWithApplications extends SupplierCredit {
  sourceDocument: PayableDocumentRef | null;
  applications: SupplierCreditApplication[];
}

export interface SupplierStatementTotals {
  totalDebt: string;
  totalPaid: string;
  totalBalance: string;
  availableCredit: string;
}

// GET /accounts-payable/suppliers/:supplierId/statement
export interface SupplierStatement {
  supplier: { id: string; name: string };
  totals: SupplierStatementTotals;
  payables: AccountsPayable[];
  credits: SupplierCreditWithApplications[];
}
