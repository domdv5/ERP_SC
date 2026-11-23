import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EgresoPaymentLineDto } from './create-egreso.dto';

async function errorsFor(method: string) {
  const line = plainToInstance(EgresoPaymentLineDto, { method, amount: 1000 });
  return validate(line);
}

describe('EgresoPaymentLineDto', () => {
  it.each(['efectivo_oficina', 'consignacion_oficina'])(
    'acepta %s',
    async (method) => {
      expect(await errorsFor(method)).toHaveLength(0);
    },
  );

  it.each(['efectivo_almacen', 'consignacion_almacen', 'cheque'])(
    'rechaza %s',
    async (method) => {
      const errors = await errorsFor(method);
      expect(errors.map((e) => e.property)).toContain('method');
    },
  );
});
