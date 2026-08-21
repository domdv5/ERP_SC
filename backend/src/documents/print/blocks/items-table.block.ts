import type { Content, TableCell } from 'pdfmake/interfaces';
import type { DocumentForPrint } from '@/documents/documents.service';
import { computeItemIva } from '../helpers/pdf-totals.helper';
import { formatCOP } from '../helpers/format.helper';

const HEADERS = [
  'Código',
  'Descripción',
  'Cant.',
  'V.Unit.',
  'V.IVA',
  'V.Unit.Total',
  'Subtotal',
];

export function buildItemsTable(
  items: DocumentForPrint['documentItems'],
): Content {
  const rows: TableCell[][] = items.map((item) => {
    const unitCost = Number(item.unitCost);
    // V.IVA es el IVA de una sola unidad (no el de la línea completa) — así
    // V.Unit.Total = unitCost + su IVA queda coherente como valor unitario.
    const unitIva = computeItemIva(unitCost);
    const unitTotal = unitCost + unitIva;

    return [
      { text: item.product.code, fontSize: 7 },
      { text: item.product.description, fontSize: 7 },
      { text: String(item.quantity), fontSize: 7, alignment: 'right' },
      { text: formatCOP(unitCost), fontSize: 7, alignment: 'right' },
      { text: formatCOP(unitIva), fontSize: 7, alignment: 'right' },
      { text: formatCOP(unitTotal), fontSize: 7, alignment: 'right' },
      { text: formatCOP(item.subtotal), fontSize: 7, alignment: 'right' },
    ];
  });

  const headerRow: TableCell[] = HEADERS.map((header) => ({
    text: header,
    bold: true,
    fontSize: 7,
    fillColor: '#e5e5e5',
  }));

  return {
    table: {
      headerRows: 1,
      widths: ['12%', '34%', '8%', '13%', '11%', '11%', '11%'],
      body: [headerRow, ...rows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
    },
  };
}
