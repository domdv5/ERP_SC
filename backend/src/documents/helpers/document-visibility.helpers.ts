import { ForbiddenException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';

// Cartera, libro oficial y casos de inventario enlazan a documentos de cualquier tipo, así que quien los lee ve todos.
const SEE_ALL_PERMISSIONS = [
  'ar.read',
  'ap.read',
  'official.read',
  'inventory_case.read',
];

/** Tipos que el rol ve: todos con cartera, libro oficial o casos de inventario; si no, los que crea, anula o convierte. */
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
