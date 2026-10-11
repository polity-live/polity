import { mutationDiagnostic, mutationTransactionIdentity } from './zero-mutation-diagnostics';

/** Benchmark-only local provider adapter. Application delivery remains the default. */
export async function mutationBenchmarkDelivery<T>(
  provider: string,
  deliver: () => Promise<T>
): Promise<T | { statusCode: number }> {
  if (process.env.ZERO_PERFORMANCE_DIAGNOSTICS !== '1') return deliver();
  const configured = process.env.ZERO_PERFORMANCE_DELIVERY_URL;
  if (!configured) throw new Error('Missing deterministic benchmark delivery endpoint');
  const address = new URL(configured);
  if (
    address.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', 'host.docker.internal'].includes(address.hostname) ||
    Number(address.port) < 15628 ||
    Number(address.port) > 15818 ||
    (Number(address.port) - 15628) % 10 !== 0
  )
    throw new Error('Invalid isolated benchmark delivery endpoint');
  // No user content, credentials, subscription keys or endpoint URLs are logged or forwarded.
  const started = performance.now();
  try {
    const result = await fetch(address, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider }),
      signal: AbortSignal.timeout(5_000),
    });
    if (result.status !== 201) throw new Error('Benchmark delivery provider failed');
    mutationDiagnostic('external-web-push', started, mutationTransactionIdentity(), 'completed');
    return { statusCode: 201 };
  } catch (error) {
    mutationDiagnostic('external-web-push', started, mutationTransactionIdentity(), 'failed');
    throw error;
  }
}
