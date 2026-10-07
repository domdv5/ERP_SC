import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { DocumentForPrint } from '@/documents/documents.service';
import {
  buildHeader,
  buildSaleFooter,
  buildSaleItemsTable,
  buildTotalsBox,
} from '../blocks/index';
import { computeSalePrintTotals } from '../helpers/pdf-totals.helper';

/** Diseño compartido de los documentos de venta: precio de venta con IVA incluido; la leyenda legal DIAN es opcional por tipo. */
export function buildSaleDocumentDefinition(
  document: DocumentForPrint,
  opts: { title: string; showLegalLegend: boolean },
): TDocumentDefinitions {
  const totals = computeSalePrintTotals(document.documentItems);

  return {
    pageSize: 'LETTER',
    pageMargins: [30, 120, 30, opts.showLegalLegend ? 85 : 60],
    header: buildHeader(document, opts.title, { showSeller: true }),
    footer: buildSaleFooter(document, opts.showLegalLegend),
    content: [
      buildSaleItemsTable(document.documentItems),
      buildTotalsBox(totals),
    ],
    defaultStyle: { font: 'Roboto', fontSize: 8 },
  };
}
