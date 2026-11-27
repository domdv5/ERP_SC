// Contrato del módulo de excedentes: GET/POST /excesses y la anulación, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

export type ExcessPartyType = 'customer' | 'supplier';

// partial: excedente viejo usado en parte antes de la regla "completo o nada"
export type ExcessStatus = 'available' | 'partial' | 'used' | 'voided';

export type ExcessVoidReason =
  'valor_mal_digitado' | 'tercero_equivocado' | 'otro';

// Recibo de caja (RC) o egreso (EG) que usó el excedente; solo cuentan los no anulados
export interface ExcessUsage {
  id: string;
  documentType: 'RC' | 'EG';
  number: string;
  date: string;
}

export interface ExcessItem {
  id: string;
  partyType: ExcessPartyType;
  number: string;
  date: string;
  amount: string;
  balance: string;
  status: ExcessStatus;
  thirdParty: { id: string; name: string; documentNumber: string };
  // Solo clientes; null = cuentas sin sucursal (y siempre null en proveedores)
  customerBranch: { id: string; name: string } | null;
  usages: ExcessUsage[];
  voidedAt: string | null;
  voidReason: ExcessVoidReason | null;
  voidReasonOther: string | null;
  createdAt: string;
}

export interface ExcessListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// GET /excesses?partyType=customer|supplier&search=&status=&page=&limit=
export interface ExcessListResponse {
  items: ExcessItem[];
  meta: ExcessListMeta;
}

// POST /excesses → ExcessItem
export interface CreateExcessBody {
  partyType: ExcessPartyType;
  thirdPartyId: string;
  // Solo clientes con sucursales; omitido = cuentas sin sucursal
  customerBranchId?: string;
  amount: number;
  // YYYY-MM-DD, default hoy (Bogotá), nunca futura
  date?: string;
}

// POST /excesses/customers/:id/void y /excesses/suppliers/:id/void → ExcessItem
export interface VoidExcessBody {
  reason: ExcessVoidReason;
  // Obligatorio solo con reason = 'otro'
  reasonOther?: string;
}
