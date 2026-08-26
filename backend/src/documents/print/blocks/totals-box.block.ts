import type { Content } from 'pdfmake/interfaces';
import type { PrintTotals } from '../helpers/pdf-totals.helper';
import { formatCOP } from '../helpers/format.helper';

const ZERO = formatCOP(0);

function row(label: string, value: string, bold = false): Content[] {
  return [
    { text: label, fontSize: 8, bold, alignment: 'left' },
    { text: value, fontSize: 8, bold, alignment: 'right' },
  ];
}

/** RET FUENTE / IMP-BOLSA / DESCUENTO se muestran fijas en $0 — el dominio no modela esos cálculos, pero se quieren visibles en el formato (confirmado con el usuario). */
export function buildTotalsBox(totals: PrintTotals): Content {
  return {
    margin: [0, 10, 0, 0],
    columns: [
      { width: '*', text: '' },
      {
        width: 200,
        table: {
          widths: ['*', 80],
          body: [
            row('RET FUENTE', ZERO),
            row('SUB TOTAL', formatCOP(totals.subtotal)),
            row('VALOR IVA', formatCOP(totals.iva)),
            row('IMP-BOLSA', ZERO),
            row('DESCUENTO', ZERO),
            row('VALOR TOTAL', formatCOP(totals.total), true),
          ],
        },
        layout: 'noBorders',
      },
    ],
  };
}
