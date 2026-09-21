import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';

/** Claves válidas de consecutivo: los 12 tipos de documento, más los de tesorería. */
export type SequenceKey = DocumentType | 'EGRESO' | 'RECIBO_CAJA';

@Injectable()
export class SequenceService {
  /** Consecutivo atómico por clave, ceros a la izquierda a 6 dígitos: ON CONFLICT bloquea la fila hasta el COMMIT, sin huecos por rollback. */
  async next(tx: Prisma.TransactionClient, key: SequenceKey): Promise<string> {
    const rows = await tx.$queryRaw<{ last_value: number }[]>`
      INSERT INTO "sequence" ("key", "last_value") VALUES (${key}, 1)
      ON CONFLICT ("key") DO UPDATE SET "last_value" = "sequence"."last_value" + 1
      RETURNING "last_value"
    `;

    return String(rows[0].last_value).padStart(6, '0');
  }
}
