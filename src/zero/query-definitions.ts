import type { AnyQueryDefinition } from '@rocicorp/zero';

const MAX_ARGUMENTS_PER_CONTEXT = 64;

/**
 * Reuses deterministic application builders, never their rows or auth decisions.
 * Zero still validates arguments, registers/materializes the query and applies
 * every live permission predicate. A new request/client context has its own cache.
 * Opt in only definitions whose builders do not read the clock or external state.
 */
export function memoizeQueryDefinitions<T extends Record<string, AnyQueryDefinition>>(
  definitions: T
): T {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => {
      const contexts = new WeakMap<object, Map<string, ReturnType<AnyQueryDefinition['fn']>>>();
      return [
        name,
        {
          ...definition,
          fn: (input: Parameters<AnyQueryDefinition['fn']>[0]) => {
            if (!input.ctx || typeof input.ctx !== 'object') return definition.fn(input);
            // Include context values as well as identity: even mutation of an
            // existing object cannot reuse another account's builder.
            const key = JSON.stringify([input.ctx, input.args]);
            let cache = contexts.get(input.ctx);
            if (!cache) {
              cache = new Map();
              contexts.set(input.ctx, cache);
            }
            const retained = cache.get(key);
            if (retained !== undefined) {
              cache.delete(key);
              cache.set(key, retained);
              return retained;
            }
            const query = definition.fn(input);
            if (cache.size >= MAX_ARGUMENTS_PER_CONTEXT) {
              // At the capacity limit the map necessarily has an oldest key.
              const oldest = cache.keys().next().value as string;
              cache.delete(oldest);
            }
            cache.set(key, query);
            return query;
          },
        },
      ];
    })
  ) as T;
}
