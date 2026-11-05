import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CloseInventoryCaseDto,
  CLOSE_MESSAGES,
} from './close-inventory-case.dto';

const errorsFor = async (body: Record<string, unknown>) => {
  const errors = await validate(plainToInstance(CloseInventoryCaseDto, body));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
};

describe('CloseInventoryCaseDto', () => {
  const valid = { cause: 'otro', justification: 'Se contó mal' };

  it('acepta un cierre válido', async () => {
    await expect(errorsFor(valid)).resolves.toEqual([]);
  });

  it('usa el mismo mensaje del service para ajuste_anulado', async () => {
    await expect(
      errorsFor({ ...valid, cause: 'ajuste_anulado' }),
    ).resolves.toEqual([CLOSE_MESSAGES.systemCause]);
  });

  it('usa el mismo mensaje del service para justificación vacía', async () => {
    await expect(
      errorsFor({ ...valid, justification: '   ' }),
    ).resolves.toEqual([CLOSE_MESSAGES.justificationRequired]);
  });

  it('usa el mismo mensaje del service para justificación demasiado larga', async () => {
    await expect(
      errorsFor({ ...valid, justification: 'x'.repeat(1001) }),
    ).resolves.toEqual([CLOSE_MESSAGES.justificationTooLong]);
  });
});
