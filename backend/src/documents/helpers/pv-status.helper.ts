import { DocumentStatus, DocumentType } from '@/common/enums';

/** Tipos cuya reserva se puede convertir en venta; el bloque de estado de conversión aplica a ellos. */
const CONVERTIBLE_TYPES: DocumentType[] = [DocumentType.PV, DocumentType.REM];

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
 * Estado de conversión de una preventa o remisión, calculado en vivo a partir de
 * sus documentos derivados (no se guarda), para que también funcione en el
 * listado, que no trae las líneas.
 * "converted": tiene al menos una venta derivada confirmada.
 * "pending": tiene alguna venta derivada sin anular, pero ninguna confirmada.
 * "none": no tiene derivadas o están todas anuladas.
 * Devuelve null para el resto de tipos.
 */
export function buildPvStatus(doc: PvStatusInput): PvStatus | null {
  if (!CONVERTIBLE_TYPES.includes(doc.type)) return null;

  const active = doc.derivedDocuments.filter(
    (d) => d.status !== DocumentStatus.voided,
  );
  const hasConfirmed = active.some((d) => d.status === DocumentStatus.confirmed);
  const status = hasConfirmed ? 'converted' : active.length ? 'pending' : 'none';

  return {
    conversion: { status, documents: doc.derivedDocuments },
  };
}
