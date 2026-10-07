import { validate } from 'class-validator';
import { EgresoPaymentMethod } from '@prisma/client';
import { IsValidChequeReference } from './is-valid-cheque-reference.validator';

class PaymentLineDto {
  method!: EgresoPaymentMethod;

  @IsValidChequeReference()
  reference?: unknown;
}

async function errorsFor(method: EgresoPaymentMethod, reference?: unknown) {
  const dto = new PaymentLineDto();
  dto.method = method;
  if (reference !== undefined) dto.reference = reference;
  return validate(dto);
}

describe('IsValidChequeReference', () => {
  it('con método cheque la referencia es obligatoria: omitida falla con el mensaje de cheque', async () => {
    const errors = await errorsFor(EgresoPaymentMethod.cheque);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isValidChequeReference).toBe(
      'El número de cheque es obligatorio para este método de pago',
    );
  });

  it('con método cheque una referencia null falla', async () => {
    expect(await errorsFor(EgresoPaymentMethod.cheque, null)).toHaveLength(1);
  });

  it('con método cheque una referencia vacía o solo espacios falla', async () => {
    expect(await errorsFor(EgresoPaymentMethod.cheque, '')).toHaveLength(1);
    expect(await errorsFor(EgresoPaymentMethod.cheque, '   ')).toHaveLength(1);
  });

  it('con método cheque una referencia con texto es válida', async () => {
    expect(await errorsFor(EgresoPaymentMethod.cheque, '123456')).toHaveLength(
      0,
    );
  });

  it('con otro método la referencia es opcional: omitida o null son válidas', async () => {
    expect(await errorsFor(EgresoPaymentMethod.efectivo_almacen)).toHaveLength(
      0,
    );
    expect(
      await errorsFor(EgresoPaymentMethod.consignacion_oficina, null),
    ).toHaveLength(0);
  });

  it('con otro método una referencia vacía es válida (solo el cheque exige contenido)', async () => {
    expect(
      await errorsFor(EgresoPaymentMethod.consignacion_almacen, ''),
    ).toHaveLength(0);
  });

  it('con cualquier método la referencia de más de 100 caracteres falla', async () => {
    const errors = await errorsFor(
      EgresoPaymentMethod.consignacion_almacen,
      'x'.repeat(101),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isValidChequeReference).toBe(
      'reference debe ser un texto de máximo 100 caracteres',
    );
  });

  it('exactamente 100 caracteres es válido', async () => {
    expect(
      await errorsFor(EgresoPaymentMethod.efectivo_oficina, 'x'.repeat(100)),
    ).toHaveLength(0);
  });

  it('con cualquier método una referencia que no es texto falla', async () => {
    expect(
      await errorsFor(EgresoPaymentMethod.efectivo_oficina, 12345),
    ).toHaveLength(1);
    expect(await errorsFor(EgresoPaymentMethod.cheque, 12345)).toHaveLength(1);
  });
});
