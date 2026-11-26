import { BadRequestException } from '@nestjs/common';
import { DocumentVoidReason } from '@prisma/client';
import { DocumentType } from '@/common/enums';

const DOCUMENT_VOID_REASONS = Object.values(DocumentVoidReason);

export type DocumentVoidReasonValue = DocumentVoidReason;

const allReasonsExcept = (...excluded: DocumentVoidReasonValue[]) =>
  DOCUMENT_VOID_REASONS.filter((reason) => !excluded.includes(reason));

// Solo estos tipos piden motivo al anular; cada uno acepta los que tienen sentido para él
export const VOID_REASONS_BY_TYPE: Partial<
  Record<DocumentType, readonly DocumentVoidReasonValue[]>
> = {
  [DocumentType.CM]: allReasonsExcept('cliente_equivocado'),
  [DocumentType.DVC]: allReasonsExcept('cliente_equivocado'),
  [DocumentType.CMO]: allReasonsExcept(
    'cliente_equivocado',
    'bodega_equivocada',
  ),
  [DocumentType.DVV]: allReasonsExcept('proveedor_equivocado'),
  [DocumentType.EAI]: [
    'cantidad_equivocada',
    'producto_equivocado',
    'costo_equivocado',
    'bodega_equivocada',
    'documento_duplicado',
    'otro',
  ],
};

/** Valida el motivo de anulación según el tipo y devuelve lo que se guarda; los tipos sin motivo devuelven null. */
export function resolveVoidReason(
  type: DocumentType,
  reason: DocumentVoidReasonValue | undefined,
  reasonOther: string | undefined,
): {
  reason: DocumentVoidReasonValue | null;
  reasonOther: string | null;
} {
  // El SAJ se corrige con una EAI: anularlo no deja rastro del porqué
  if (type === DocumentType.SAJ) {
    throw new BadRequestException(
      'La salida por ajuste no se anula: corrígela con una entrada por ajuste (EAI).',
    );
  }

  const allowedReasons = VOID_REASONS_BY_TYPE[type];
  if (!allowedReasons) return { reason: null, reasonOther: null };

  if (!reason) {
    throw new BadRequestException('Elige el motivo de la anulación');
  }
  if (!allowedReasons.includes(reason)) {
    throw new BadRequestException('Ese motivo no aplica a este documento');
  }
  if (reason !== 'otro') return { reason, reasonOther: null };

  const trimmedOther = reasonOther?.trim();
  if (!trimmedOther) {
    throw new BadRequestException('Escribe el motivo de la anulación');
  }
  return { reason, reasonOther: trimmedOther };
}
