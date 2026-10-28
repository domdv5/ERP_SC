import { assertValidJwtSecret } from './jwt-secret.helper';

describe('assertValidJwtSecret', () => {
  const valid = 'a'.repeat(32);

  it('devuelve el secreto cuando es válido', () => {
    expect(assertValidJwtSecret(valid)).toBe(valid);
  });

  it('falla si falta', () => {
    expect(() => assertValidJwtSecret(undefined)).toThrow(
      'JWT_SECRET no está definido',
    );
    expect(() => assertValidJwtSecret('')).toThrow(
      'JWT_SECRET no está definido',
    );
  });

  it('falla si tiene menos de 32 caracteres', () => {
    expect(() => assertValidJwtSecret('a'.repeat(31))).toThrow(
      'JWT_SECRET debe tener al menos 32 caracteres',
    );
  });

  it('falla si es el valor de ejemplo de .env.example', () => {
    expect(() =>
      assertValidJwtSecret(
        'cambia-este-valor-por-un-secreto-largo-y-aleatorio',
      ),
    ).toThrow('JWT_SECRET sigue con el valor de ejemplo');
  });
});
