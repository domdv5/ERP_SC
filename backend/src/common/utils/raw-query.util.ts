// $queryRaw manda BigInt o Decimal si al SQL le falta su ::int/::float8; esto los deja como number.
export function toNumberFields<T extends object, K extends keyof T>(
  rows: T[],
  keys: readonly K[],
): T[] {
  return rows.map((row) => {
    const converted = { ...row };
    for (const key of keys) {
      converted[key] = Number(converted[key]) as T[K];
    }
    return converted;
  });
}
