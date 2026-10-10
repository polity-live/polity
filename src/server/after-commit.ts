import { AsyncLocalStorage } from 'node:async_hooks';
import { mutationDiagnostic, mutationTransactionIdentity } from './zero-mutation-diagnostics';

const effects = new AsyncLocalStorage<Map<string, () => Promise<unknown>>>();
export function afterCommit(
  id: string,
  effect: () => Promise<unknown>
): Promise<unknown> | undefined {
  const pending = effects.getStore();
  if (pending) pending.set(id, effect);
  else return effect();
}
export async function withAfterCommit<T>(transaction: () => Promise<T>): Promise<T> {
  const pending = new Map<string, () => Promise<unknown>>();
  const result = await effects.run(pending, transaction);
  const started = performance.now();
  for (const [id, effect] of pending) {
    try {
      await effect();
    } catch {
      console.error('studio.post_commit_failed', { operationId: id });
    }
  }
  mutationDiagnostic('after-commit', started, mutationTransactionIdentity());
  return result;
}
