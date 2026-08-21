import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { DocumentForPrint } from '@/documents/documents.service';
import {
  buildFooter,
  buildHeader,
  buildItemsTable,
  buildTotalsBox,
} from '../blocks/index';
import { computePrintTotals } from '../helpers/pdf-totals.helper';

/** Layout compartido entre CM y DVC — ambas comparten header/tabla/totales/footer, solo cambia el título. */
export function buildPurchaseDocumentDefinition(
  document: DocumentForPrint,
  opts: { title: string },
): TDocumentDefinitions {
  const totals = computePrintTotals(document.documentItems);

  return {
    pageSize: 'LETTER',
    pageMargins: [30, 90, 30, 60],
    header: buildHeader(document, opts.title),
    footer: buildFooter(document),
    content: [buildItemsTable(document.documentItems), buildTotalsBox(totals)],
    defaultStyle: { font: 'Roboto', fontSize: 8 },
  };
}
