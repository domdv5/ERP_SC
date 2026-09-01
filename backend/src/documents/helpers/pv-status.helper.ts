import { DocumentStatus, DocumentType } from '@/common/enums';

export interface PvDerivedDoc {
  id: string;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
}

export interface PvStatusInput {
  type: DocumentType;
  derivedDocuments: PvDerivedDoc[];
}

export interface PvStatus {
  conversion: {
    status: 'none' | 'pending' | 'converted';
    documents: PvDerivedDoc[];
  };
}

/**
 * Estado de conversión de una PV, derivado en vivo de derivedDocuments (no se
 * persiste) para que también funcione en las filas de lista, que no cargan items.
 * converted: hay >=1 venta derivada confirmada. pending: hay >=1 derivada no
 * anulada pero ninguna confirmada. none: sin derivadas o todas anuladas.
 * Devuelve null para type != PV (deja la fila de otros tipos sin el bloque).
 */
export function buildPvStatus(doc: PvStatusInput): PvStatus | null {
  if (doc.type !== DocumentType.PV) return null;

  const active = doc.derivedDocuments.filter(
    (d) => d.status !== DocumentStatus.voided,
  );
  const hasConfirmed = active.some((d) => d.status === DocumentStatus.confirmed);
  const status = hasConfirmed ? 'converted' : active.length ? 'pending' : 'none';

  return {
    conversion: { status, documents: doc.derivedDocuments },
  };
}
