import { Prisma } from '@prisma/client';
import { toCents } from '@/common/utils/money.util';
import type { CreateDocumentDto } from '../dto/index';

export const DUPLICATE_REQUEST_MESSAGE =
  'Esta operación ya se registró con datos distintos. Recarga la página y revisa el listado de operaciones.';

export type ExistingDocumentForIdempotency = {
  type: string;
  userId: string;
  thirdPartyId: string | null;
  documentItems: {
    productId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
  }[];
};

function itemsSignature(
  items: {
    productId: string;
    quantity: number;
    unitPrice: number | Prisma.Decimal;
  }[],
) {
  return items
    .map(
      (item) => `${item.productId}:${item.quantity}:${toCents(item.unitPrice)}`,
    )
    .sort()
    .join('|');
}

/** Compara el reintento contra el documento ya guardado con la misma clave: mismo usuario, tipo, tercero e ítems (sin importar el orden). */
export function isSameDocumentRequest(
  dto: CreateDocumentDto,
  existing: ExistingDocumentForIdempotency,
  userId: string,
): boolean {
  return (
    existing.userId === userId &&
    existing.type === dto.type &&
    (existing.thirdPartyId ?? null) === (dto.thirdPartyId ?? null) &&
    itemsSignature(existing.documentItems) ===
      itemsSignature(
        dto.items.map((item) => ({ ...item, unitPrice: item.unitPrice ?? 0 })),
      )
  );
}

export function isIdempotencyKeyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    ((error.meta?.target as string[] | undefined)?.includes(
      'idempotency_key',
    ) ??
      false)
  );
}
