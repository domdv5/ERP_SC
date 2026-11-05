import { ForbiddenException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';

// Cartera y libro oficial enlazan a documentos de cualquier tipo, así que quien los lee ve todos.
const SEE_ALL_PERMISSIONS = ['ar.read', 'ap.read', 'official.read'];

// Tipos cuya estrategia mueve stock (moveStock): los que aparecen en el kardex de un caso de inventario.
export const STOCK_MOVING_TYPES: DocumentType[] = [
  DocumentType.CM,
  DocumentType.DVC,
  DocumentType.EAI,
  DocumentType.SAJ,
  DocumentType.T,
  DocumentType.POS,
  DocumentType.COT,
  DocumentType.DVV,
];

/** Tipos que el rol ve: todos con cartera o libro oficial; si no, los que crea, anula o convierte, más los que mueven inventario si lee casos de inventario. */
export function findVisibleDocumentTypes(
  permissions: string[],
): DocumentType[] {
  if (SEE_ALL_PERMISSIONS.some((p) => permissions.includes(p))) {
    return Object.values(DocumentType);
  }
  const prefixes = ['document.create.', 'document.void.', 'document.convert.'];
  const valid = new Set<string>(Object.values(DocumentType));
  const types = permissions.flatMap((p) => {
    const prefix = prefixes.find((pre) => p.startsWith(pre));
    return prefix ? [p.slice(prefix.length)] : [];
  });
  if (permissions.includes('inventory_case.read')) {
    types.push(...STOCK_MOVING_TYPES);
  }
  return [...new Set(types)].filter((t): t is DocumentType => valid.has(t));
}

export function assertCanViewDocument(
  permissions: string[],
  type: DocumentType,
) {
  if (!findVisibleDocumentTypes(permissions).includes(type)) {
    throw new ForbiddenException(
      `No tiene permiso para ver documentos de tipo ${type}`,
    );
  }
}
