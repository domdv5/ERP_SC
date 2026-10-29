import type { Prisma } from '@prisma/client';

/** Cómo queda un valor después de JSON.stringify: Decimal y Date pasan a string. */
export type AsJson<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? string
    : T extends string | number | boolean | null | undefined
      ? T
      : T extends readonly (infer Item)[]
        ? AsJson<Item>[]
        : { [Key in keyof T]: AsJson<T[Key]> };

interface ContractMismatch {
  error: 'El resultado no cumple el contrato';
}

/** Compila solo si el valor, ya en JSON, cumple el contrato; devuelve el mismo valor sin tocarlo. */
export function matchContract<Contract>() {
  return <Actual>(
    value: Actual &
      (AsJson<Actual> extends Contract ? unknown : ContractMismatch),
  ): Actual => value;
}
