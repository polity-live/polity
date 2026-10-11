export function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error('Missing required benchmark value');
  return value;
}
export function withDeadline<T>(
  promise: Promise<T>,
  label: string,
  milliseconds = 15_000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}
