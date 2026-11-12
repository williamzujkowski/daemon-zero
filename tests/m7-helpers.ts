/** Fail test setup explicitly when a required piece of authored content is missing. */
export function defined<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('Missing test setup value');
  return value;
}
