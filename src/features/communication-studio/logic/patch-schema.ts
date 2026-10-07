import { z } from 'zod';
/** Patch omission must not materialize document defaults. */
export function optionalFields<T extends z.ZodRawShape>(shape: T) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [
      key,
      z.optional(value instanceof z.ZodDefault ? value.unwrap() : value),
    ])
  ) as { [K in keyof T]: z.ZodOptional<T[K] extends z.ZodDefault<infer U> ? U : T[K]> };
}
