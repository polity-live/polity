import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

interface RequestContext {
  requestID: string;
  identities: MutationIdentity[];
  transaction?: Pick<MutationIdentity, 'clientGroupID' | 'clientID' | 'mutationID'>;
}
export interface MutationIdentity {
  clientGroupID: string;
  clientID: string;
  mutationID: number;
  name: string;
}
const requests = new AsyncLocalStorage<RequestContext>();
const exportedRegistries = new WeakSet<object>();
const enabled = () => process.env.ZERO_PERFORMANCE_DIAGNOSTICS === '1';
export const mutationTransactionIdentity = () => requests.getStore()?.transaction;
export function withMutationTransactionIdentity<T>(
  identity: Pick<MutationIdentity, 'clientGroupID' | 'clientID' | 'mutationID'> | undefined,
  run: () => Promise<T>
) {
  const context = requests.getStore();
  return enabled() && context && identity
    ? requests.run({ ...context, transaction: identity }, run)
    : run();
}

/** The allowlist deliberately excludes arguments, auth, timestamps and error messages. */
export function mutationIdentities(body: unknown): MutationIdentity[] {
  if (!body || typeof body !== 'object') return [];
  const push = body as { clientGroupID?: unknown; mutations?: unknown };
  if (typeof push.clientGroupID !== 'string' || !Array.isArray(push.mutations)) return [];
  return push.mutations.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (
      typeof item.clientID !== 'string' ||
      typeof item.name !== 'string' ||
      !Number.isSafeInteger(item.id) ||
      (item.id as number) < 1
    )
      return [];
    return [
      {
        clientGroupID: push.clientGroupID as string,
        clientID: item.clientID,
        mutationID: item.id as number,
        name: item.name,
      },
    ];
  });
}

export function mutationDiagnostic(
  phase: string,
  started: number,
  identity?: Pick<MutationIdentity, 'clientGroupID' | 'clientID' | 'mutationID'>,
  outcome?: 'committed' | 'rolled-back' | 'completed' | 'failed'
) {
  const context = requests.getStore();
  if (!enabled() || !context) return;
  const now = performance.now();
  console.info(
    JSON.stringify({
      benchmark: 'mutation-api',
      requestID: context.requestID,
      phase,
      at: performance.timeOrigin + now,
      elapsed: now - started,
      ...(identity
        ? {
            identity: context.identities.find(
              item =>
                item.clientGroupID === identity.clientGroupID &&
                item.clientID === identity.clientID &&
                item.mutationID === identity.mutationID
            ) ?? {
              clientGroupID: identity.clientGroupID,
              clientID: identity.clientID,
              mutationID: identity.mutationID,
            },
          }
        : {}),
      ...(outcome ? { outcome } : {}),
    })
  );
}

export function mutationRegistryNames(registry: unknown): string[] {
  const names: string[] = [];
  function visit(value: unknown) {
    if (
      typeof value === 'function' &&
      'mutatorName' in value &&
      typeof value.mutatorName === 'string'
    ) {
      names.push(value.mutatorName);
      return;
    }
    if (value && typeof value === 'object')
      for (const [key, child] of Object.entries(value)) if (key !== '~') visit(child);
  }
  visit(registry);
  return names.sort();
}
export async function withMutationDiagnostics<T>(
  request: Request,
  run: () => Promise<T>,
  registry?: unknown
) {
  if (!enabled()) return run();
  const started = performance.now();
  // Reading a clone preserves Zero's parsing, validation and batching of the original request.
  let identities: MutationIdentity[] = [];
  try {
    identities = mutationIdentities(await request.clone().json());
  } catch {
    /* Zero validates. */
  }
  const context = { requestID: randomUUID(), identities };
  return requests.run(context, async () => {
    console.info(
      JSON.stringify({
        benchmark: 'mutation-api',
        requestID: context.requestID,
        phase: 'arrival',
        at: performance.timeOrigin + started,
        elapsed: 0,
        identities,
      })
    );
    if (
      registry &&
      (typeof registry === 'object' || typeof registry === 'function') &&
      !exportedRegistries.has(registry)
    ) {
      console.info(
        JSON.stringify({
          benchmark: 'mutation-api',
          requestID: context.requestID,
          phase: 'registry',
          at: performance.timeOrigin + performance.now(),
          elapsed: 0,
          names: mutationRegistryNames(registry),
        })
      );
      exportedRegistries.add(registry);
    }
    try {
      return await run();
    } finally {
      mutationDiagnostic('response', started);
    }
  });
}

export async function diagnoseMutationTransaction<T>(
  run: () => Promise<T>,
  identity?: Pick<MutationIdentity, 'clientGroupID' | 'clientID' | 'mutationID'>
): Promise<T> {
  if (!enabled() || !requests.getStore() || !identity) return run();
  const started = performance.now();
  try {
    const result = await run();
    mutationDiagnostic('transaction', started, identity, 'committed');
    return result;
  } catch (error) {
    mutationDiagnostic('transaction', started, identity, 'rolled-back');
    throw error;
  }
}
