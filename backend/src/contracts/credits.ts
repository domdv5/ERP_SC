// Contrato de saldos a favor: GET /credits/customers y /credits/suppliers (lista y detalle), tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

export type CreditStatus = 'available' | 'partial' | 'used' | 'voided';

export interface CreditOrigin {
  kind: 'devolucion' | 'excedente';
  // Null en excedentes: no nacen de un documento
  documentType: string | null;
  documentNumber: string | null;
}

export interface CreditApplication {
  id: string;
  // POS | COT | RC | EG; null en pagos históricos sin egreso
  documentType: string | null;
  documentNumber: string | null;
  amount: string;
  date: string;
}

export interface CreditListItem {
  id: string;
  name: string;
  documentNumber: string;
  creditCount: number;
  availableTotal: string;
}

export interface CreditListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// GET /credits/customers y GET /credits/suppliers
export interface CreditListResponse {
  items: CreditListItem[];
  meta: CreditListMeta;
}

export interface CreditDetailItem {
  id: string;
  origin: CreditOrigin;
  date: string;
  amount: string;
  used: string;
  balance: string;
  status: CreditStatus;
  // Null si el saldo no está anulado
  voidedAt: string | null;
  applications: CreditApplication[];
}

export interface CustomerCreditDetailItem extends CreditDetailItem {
  usableIn: 'facturacion' | 'administracion';
  branchName: string | null;
}

export interface CreditThirdPartyHeader {
  id: string;
  name: string;
  documentNumber: string;
  availableTotal: string;
}

// GET /credits/customers/:id
export interface CustomerCreditsDetail {
  customer: CreditThirdPartyHeader;
  credits: CustomerCreditDetailItem[];
}

// GET /credits/suppliers/:id
export interface SupplierCreditsDetail {
  supplier: CreditThirdPartyHeader;
  credits: CreditDetailItem[];
}
