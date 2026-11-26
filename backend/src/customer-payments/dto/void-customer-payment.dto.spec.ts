import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VoidCustomerPaymentDto } from './void-customer-payment.dto';

async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(VoidCustomerPaymentDto, body));
}

describe('VoidCustomerPaymentDto', () => {
  it.each([undefined, '', 'inventado', 'proveedor_equivocado', 123])(
    'rechaza un motivo fuera de la lista (%p)',
    async (reason) => {
      const errors = await errorsFor({ reason });
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toContain(
        'Elige un motivo de anulación válido',
      );
    },
  );

  it.each([undefined, '', '   '])(
    'rechaza "otro" sin texto (%p)',
    async (reasonOther) => {
      const errors = await errorsFor({ reason: 'otro', reasonOther });
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toContain(
        'Escribe el motivo de la anulación',
      );
    },
  );

  it('rechaza "otro" con más de 500 caracteres', async () => {
    const errors = await errorsFor({
      reason: 'otro',
      reasonOther: 'a'.repeat(501),
    });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      'El motivo no puede superar 500 caracteres',
    );
  });

  it.each([
    { reason: 'valor_equivocado' },
    { reason: 'cliente_equivocado' },
    { reason: 'pago_no_recibido' },
    { reason: 'pago_duplicado', reasonOther: '   ' },
    { reason: 'otro', reasonOther: 'Error de digitación' },
  ])('acepta un motivo válido (%j)', async (body) => {
    expect(await errorsFor(body)).toHaveLength(0);
  });
});
