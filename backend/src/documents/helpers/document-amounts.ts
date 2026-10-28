import { BadRequestException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { CreateDocumentItemDto } from '../dto/index';
import {
  computeOfficialLine,
  OFFICIAL_TAX_TYPES,
  splitOfficialPrice,
  sumOfficialLines,
} from './tax.helpers';

/** Documentos valorados al precio de venta (el resto se valora al costo); DVV usa unitPrice a diferencia de DVC. */
const PRICE_BASED_TYPES: ReadonlySet<DocumentType> = new Set([
  DocumentType.PV,
  DocumentType.REM,
  DocumentType.POS,
  DocumentType.COT,
  DocumentType.DVV,
  DocumentType.POSO,
]);

export function computeItemSubtotal(
  item: CreateDocumentItemDto,
  type: DocumentType,
) {
  const usePrice = PRICE_BASED_TYPES.has(type);
  return (
    item.quantity * (usePrice ? (item.unitPrice ?? 0) : (item.unitCost ?? 0))
  );
}

export function computeTotal(
  items: CreateDocumentItemDto[],
  type: DocumentType,
) {
  return items.reduce((sum, item) => sum + computeItemSubtotal(item, type), 0);
}

/** Subtotales, IVA y total del documento; CMO digita valor sin IVA, POSO precio con IVA; en ambos el IVA se guarda aparte. */
export function computeAmounts(
  items: CreateDocumentItemDto[],
  type: DocumentType,
) {
  if (!OFFICIAL_TAX_TYPES.has(type)) {
    return {
      lines: items.map((item) => ({
        subtotal: computeItemSubtotal(item, type),
        taxAmount: null as number | null,
      })),
      total: computeTotal(items, type),
      taxTotal: null as number | null,
    };
  }

  const usePrice = PRICE_BASED_TYPES.has(type);
  const official = items.map((item) =>
    usePrice
      ? splitOfficialPrice(item.quantity, item.unitPrice ?? 0)
      : computeOfficialLine(item.quantity, item.unitCost ?? 0),
  );
  const totals = sumOfficialLines(official);

  return {
    lines: official.map((line) => ({
      subtotal: line.subtotal.toNumber(),
      taxAmount: line.taxAmount.toNumber(),
    })),
    total: totals.total.toNumber(),
    taxTotal: totals.taxTotal.toNumber(),
  };
}

/** Los campos de facturación oficial solo aplican a ciertos tipos; en el resto se rechazan en vez de ignorarse. */
export function assertOfficialFieldsAllowed(
  type: DocumentType,
  fields: {
    officialPurchase?: boolean;
    supplierInvoiceNumber?: string;
    sourceDocumentId?: string;
  },
) {
  if (fields.officialPurchase && type !== DocumentType.CM) {
    throw new BadRequestException(
      'Solo una compra (CM) puede marcarse como oficial',
    );
  }

  if (
    fields.supplierInvoiceNumber?.trim() &&
    type !== DocumentType.CM &&
    type !== DocumentType.CMO
  ) {
    throw new BadRequestException(
      'El número de factura del proveedor solo aplica a compras',
    );
  }

  if (fields.sourceDocumentId && type !== DocumentType.CMO) {
    throw new BadRequestException(
      'Solo una compra oficial (CMO) puede enlazar una compra de origen',
    );
  }
}
