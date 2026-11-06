// Contrato de terceros: lo que entregan los endpoints de /third-parties, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type { City, Department } from './locations';

export type WithholdingAgentType =
  | 'ninguno'
  | 'gran_contribuyente'
  | 'autorretenedor_renta'
  | 'agente_retencion_iva';

export type TaxRegime = 'ordinario' | 'rst' | 'no_aplica';

// personType y documentType son texto libre en la BD: el backend no manda uniones
export interface ThirdPartyRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cityCode: string | null;
  isActive: boolean;
  isSeller: boolean;
  isReceiver: boolean;
  isCustomer: boolean;
  isSupplier: boolean;
  personType: string;
  documentType: string;
  documentNumber: string;
  firstName: string | null;
  lastName: string | null;
  ivaResponsible: boolean | null;
  withholdingAgentType: WithholdingAgentType | null;
  taxRegime: TaxRegime | null;
  deletedAt: string | null;
  deletedById: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CityWithDepartment extends City {
  departmentCode: string;
  department: Department;
}

export interface Customer {
  id: string;
  sellerId: string | null;
  creditLimit: string | null;
  discount: string | null;
}

// PATCH /third-parties/:id/branches/:branchId
export interface CustomerBranch {
  id: string;
  customerId: string;
  name: string;
  address: string | null;
  cityCode: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerBranchWithCity extends CustomerBranch {
  city: CityWithDepartment | null;
}

export interface CustomerDetail extends Customer {
  branches: CustomerBranchWithCity[];
}

export interface Supplier {
  id: string;
  internalNumber: number;
  discountNotes: string | null;
}

// PATCH /third-parties/:id/brands/:brandId
export interface SupplierBrand {
  id: string;
  name: string;
  active: boolean;
  supplierId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDetail extends Supplier {
  brands: SupplierBrand[];
}

// GET /third-parties, GET /third-parties/:id y PATCH /third-parties/:id
export interface ThirdPartyDetail extends ThirdPartyRecord {
  city: CityWithDepartment | null;
  customer: CustomerDetail | null;
  supplier: SupplierDetail | null;
}

// POST /third-parties: sin ciudad, y cliente/proveedor sin sucursales ni marcas
export interface ThirdPartyCreated extends ThirdPartyRecord {
  customer: Customer | null;
  supplier: Supplier | null;
}

export interface ThirdPartyListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  customerCount: number;
  supplierCount: number;
}

export interface ThirdPartyListResponse {
  items: ThirdPartyDetail[];
  meta: ThirdPartyListMeta;
}
