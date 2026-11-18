import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VoidEgresoDto } from './void-egreso.dto';

async function errorsFor(reason: unknown) {
  return validate(plainToInstance(VoidEgresoDto, { reason }));
}

describe('VoidEgresoDto', () => {
  it.each([undefined, '', '   ', 123])(
    'rechaza el motivo vacío o inválido (%p)',
    async (reason) => {
      const errors = await errorsFor(reason);
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toContain(
        'Indica el motivo de la anulación',
      );
    },
  );

  it('rechaza más de 500 caracteres', async () => {
    expect(await errorsFor('a'.repeat(501))).toHaveLength(1);
  });

  it('acepta un motivo normal', async () => {
    expect(await errorsFor('Error de digitación')).toHaveLength(0);
  });
});
