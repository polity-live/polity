import assert from 'node:assert/strict';

interface FreshBenchmarkClient {
  readonly idbName: string;
  delete(): Promise<{ deleted: string[]; errors: unknown[] }>;
}

/** Unique benchmark storage is disposable after metrics and plan collection. */
export async function deleteFreshBenchmarkClient(client: FreshBenchmarkClient): Promise<void> {
  // close() stops synchronization but retains named in-memory databases. The
  // public delete() API closes and removes only this client's own storage.
  const result = await client.delete();
  if (result.errors.length) {
    throw new AggregateError(result.errors, 'Deleting fresh benchmark client storage failed');
  }
  assert.ok(
    result.deleted.includes(client.idbName),
    'Fresh benchmark client did not delete its own registered database'
  );
}
