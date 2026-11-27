import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateExcessDto } from './create-excess.dto';

const base = {
  partyType: 'customer',
  thirdPartyId: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
};

async function errorsFor(amount: unknown) {
  return validate(plainToInstance(CreateExcessDto, { ...base, amount }));
}

describe('CreateExcessDto amount', () => {
  it('acepta el máximo que cabe en Decimal(16,2)', async () => {
    expect(await errorsFor(99999999999999.99)).toEqual([]);
  });

  it.each([100000000000000, 1e20])(
    'rechaza un valor demasiado grande (%p)',
    async (amount) => {
      const errors = await errorsFor(amount);
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toContain(
        'El valor del excedente es demasiado grande',
      );
    },
  );
});
