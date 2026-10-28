const EXAMPLE_SECRET = 'cambia-este-valor-por-un-secreto-largo-y-aleatorio';
const MIN_LENGTH = 32;

// Con un secreto débil o el de ejemplo cualquiera puede firmar tokens válidos: mejor no arrancar.
export function assertValidJwtSecret(secret: string | undefined): string {
  if (!secret) {
    throw new Error('JWT_SECRET no está definido');
  }
  if (secret === EXAMPLE_SECRET) {
    throw new Error('JWT_SECRET sigue con el valor de ejemplo de .env.example');
  }
  if (secret.length < MIN_LENGTH) {
    throw new Error(`JWT_SECRET debe tener al menos ${MIN_LENGTH} caracteres`);
  }
  return secret;
}
