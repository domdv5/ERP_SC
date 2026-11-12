import { Prisma } from '@prisma/client';
import type { Content } from 'pdfmake/interfaces';
import { PaymentMethod } from '@/common/enums';
import { formatCOP } from '../helpers/format.helper';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.efectivo_almacen]: 'Efectivo almacén',
  [PaymentMethod.consignacion_almacen]: 'Consignación almacén',
  [PaymentMethod.credito]: 'Crédito',
};

type PrintPayment = {
  method: PaymentMethod;
  amount: Prisma.Decimal | number | string;
};

function row(label: string, value: string, bold = false): Content[] {
  return [
    { text: label, fontSize: 8, bold, alignment: 'left' },
    { text: value, fontSize: 8, bold, alignment: 'right' },
  ];
}

/** Formas de pago de la venta; con una línea crédito agrega "Pagado" (sin crédito) y "A crédito". */
export function buildPaymentsBox(payments: PrintPayment[]): Content {
  if (payments.length === 0) return { text: '' };

  const amountOf = (payment: PrintPayment) =>
    new Prisma.Decimal(payment.amount);
  const credit = payments
    .filter((payment) => payment.method === PaymentMethod.credito)
    .reduce(
      (sum, payment) => sum.plus(amountOf(payment)),
      new Prisma.Decimal(0),
    );
  const paid = payments
    .filter((payment) => payment.method !== PaymentMethod.credito)
    .reduce(
      (sum, payment) => sum.plus(amountOf(payment)),
      new Prisma.Decimal(0),
    );

  const body: Content[][] = payments.map((payment) =>
    row(PAYMENT_LABELS[payment.method], formatCOP(amountOf(payment))),
  );
  if (credit.gt(0)) {
    body.push(row('Pagado', formatCOP(paid), true));
    body.push(row('A crédito', formatCOP(credit), true));
  }

  return {
    margin: [0, 10, 0, 0],
    columns: [
      {
        width: 200,
        stack: [
          {
            text: 'FORMAS DE PAGO',
            fontSize: 8,
            bold: true,
            margin: [0, 0, 0, 2],
          },
          { table: { widths: ['*', 80], body }, layout: 'noBorders' },
        ],
      },
      { width: '*', text: '' },
    ],
  };
}
