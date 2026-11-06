// Contrato del libro oficial: GET /official-ledger, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type { DocumentType } from './documents';

export interface OfficialLedgerItem {
  productId: string;
  code: string;
  name: string;
  openingBalance: number;
  purchased: number;
  sold: number;
  closingBalance: number;
}

export interface OfficialLedgerTotals {
  openingBalance: number;
  purchased: number;
  sold: number;
  closingBalance: number;
}

export interface OfficialLedgerMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  // Suma sobre todo el conjunto filtrado, no solo la página.
  totals: OfficialLedgerTotals;
}

// GET /official-ledger
export interface OfficialLedgerListResponse {
  items: OfficialLedgerItem[];
  meta: OfficialLedgerMeta;
}

// CMO suma (cantidad positiva), POSO resta (cantidad negativa).
export interface OfficialLedgerMovement {
  date: string;
  documentId: string;
  type: DocumentType;
  number: string;
  thirdPartyName: string | null;
  quantity: number;
  runningBalance: number;
}

// GET /official-ledger/products/:productId
export interface OfficialLedgerProductDetail {
  product: { id: string; code: string; name: string };
  openingBalance: number;
  closingBalance: number;
  movements: OfficialLedgerMovement[];
}
