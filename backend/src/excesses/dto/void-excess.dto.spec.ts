import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VoidExcessDto } from './void-excess.dto';

async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(VoidExcessDto, body));
}

describe('VoidExcessDto', () => {
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

  it('acepta "otro" con texto y un motivo de la lista sin texto', async () => {
    expect(
      await errorsFor({ reason: 'otro', reasonOther: 'Duplicado' }),
    ).toEqual([]);
    expect(await errorsFor({ reason: 'valor_mal_digitado' })).toEqual([]);
  });
});
