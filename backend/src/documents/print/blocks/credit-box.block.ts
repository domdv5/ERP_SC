import { Prisma } from '@prisma/client';
import type { Content } from 'pdfmake/interfaces';
import { PaymentMethod } from '@/common/enums';
import { formatCOP } from '../helpers/format.helper';

type PrintPayment = {
  method: PaymentMethod;
  amount: Prisma.Decimal | number | string;
};

/** Al cliente solo le importa cuánto quedó debiendo: imprime "A crédito" si la venta tiene esa línea. */
export function buildCreditBox(payments: PrintPayment[]): Content {
  const credit = payments
    .filter((payment) => payment.method === PaymentMethod.credito)
    .reduce(
      (sum, payment) => sum.plus(new Prisma.Decimal(payment.amount)),
      new Prisma.Decimal(0),
    );
  if (credit.lte(0)) return { text: '' };

  return {
    margin: [0, 10, 0, 0],
    columns: [
      {
        width: 200,
        table: {
          widths: ['*', 80],
          body: [
            [
              { text: 'A crédito', fontSize: 8, bold: true, alignment: 'left' },
              {
                text: formatCOP(credit),
                fontSize: 8,
                bold: true,
                alignment: 'right',
              },
            ],
          ],
        },
        layout: 'noBorders',
      },
      { width: '*', text: '' },
    ],
  };
}
