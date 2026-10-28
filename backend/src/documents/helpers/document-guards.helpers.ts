import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';

// `action` elige el permiso: crear cubre todo el ciclo normal, liberar reserva tiene permiso propio (puede ser otro rol).
export function assertDocumentPermission(
  user: JwtPayload,
  type: DocumentType,
  action: 'create' | 'release' | 'convert' | 'void' = 'create',
) {
  if (!user.permissions.includes(`document.${action}.${type}`)) {
    const actionLabel =
      action === 'release'
        ? 'liberar reservas de'
        : action === 'convert'
          ? 'convertir'
          : action === 'void'
            ? 'anular'
            : 'crear';
    throw new ForbiddenException(
      `No tiene permiso para ${actionLabel} documentos de tipo ${type}`,
    );
  }
}

/** Bloquea la fila del documento hasta el fin de la transacción y devuelve su estado actual. */
export async function lockDocumentStatus(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const rows = await tx.$queryRaw<{ status: DocumentStatus }[]>`
    SELECT status FROM document WHERE id = ${id}::uuid FOR UPDATE
  `;
  return rows[0]?.status;
}
