import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReciboCajaPaymentLineDto } from './create-recibo-caja.dto';

async function errorsFor(method: string) {
  const line = plainToInstance(ReciboCajaPaymentLineDto, {
    method,
    amount: 1000,
  });
  return validate(line);
}

describe('ReciboCajaPaymentLineDto', () => {
  it.each(['efectivo_oficina', 'consignacion_oficina'])(
    'acepta %s',
    async (method) => {
      expect(await errorsFor(method)).toHaveLength(0);
    },
  );

  it.each(['efectivo_almacen', 'consignacion_almacen', 'cheque'])(
    'rechaza %s con mensaje en español',
    async (method) => {
      const errors = await errorsFor(method);
      const methodError = errors.find((e) => e.property === 'method');
      expect(Object.values(methodError?.constraints ?? {})).toContain(
        'La forma de pago debe ser efectivo_oficina o consignacion_oficina',
      );
    },
  );
});
