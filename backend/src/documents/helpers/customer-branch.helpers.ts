import { DocumentType } from '@/common/enums';

/** Tipos de venta que guardan la sucursal del cliente. */
export const BRANCH_TYPES: ReadonlySet<DocumentType> = new Set([
  DocumentType.PV,
  DocumentType.REM,
  DocumentType.COT,
  DocumentType.POS,
  DocumentType.DVV,
  DocumentType.POSO,
]);
