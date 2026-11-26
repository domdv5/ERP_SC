import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VoidSupplierPaymentDto } from './void-supplier-payment.dto';

async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(VoidSupplierPaymentDto, body));
}

describe('VoidSupplierPaymentDto', () => {
  it.each([undefined, '', 'inventado', 123])(
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
  });

  it.each([
    { reason: 'valor_equivocado' },
    { reason: 'pago_duplicado', reasonOther: '   ' },
    { reason: 'otro', reasonOther: 'Error de digitación' },
  ])('acepta un motivo válido (%j)', async (body) => {
    expect(await errorsFor(body)).toHaveLength(0);
  });
});
