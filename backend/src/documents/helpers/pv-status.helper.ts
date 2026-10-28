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

/** Estado de conversión de una PV/REM, calculado en vivo de sus derivados: converted (hay una confirmada), pending (hay alguna sin anular), none. */
export function buildPvStatus(doc: PvStatusInput): PvStatus | null {
  if (!CONVERTIBLE_TYPES.includes(doc.type)) return null;

  const active = doc.derivedDocuments.filter(
    (d) => d.status !== DocumentStatus.voided,
  );
  const hasConfirmed = active.some(
    (d) => d.status === DocumentStatus.confirmed,
  );
  const status = hasConfirmed
    ? 'converted'
    : active.length
      ? 'pending'
      : 'none';

  return {
    conversion: { status, documents: doc.derivedDocuments },
  };
}

/** Agrega el bloque `pv` (nombre histórico, incluye REM) con el estado de conversión; se calcula en cada lectura, no se guarda. */
export function withPvStatus<T extends PvStatusInput>(doc: T) {
  const { derivedDocuments, ...rest } = doc;
  // Solo CM: sus compras oficiales no anuladas (borradores incluidos), para enlazarlas desde la CM.
  const officialPurchases =
    doc.type === DocumentType.CM
      ? derivedDocuments.filter(
          (d) =>
            d.type === DocumentType.CMO && d.status !== DocumentStatus.voided,
        )
      : null;
  return { ...rest, pv: buildPvStatus(doc), officialPurchases };
}
