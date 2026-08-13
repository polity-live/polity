import { db, type E2EDatabase } from './db';

export const ZERO_READY_TIMEOUT_MS = 120_000;

const ZERO_STATZ_TIMEOUT_MS = 5_000;
const ZERO_READY_POLL_INTERVAL_MS = 1_000;

interface ZeroReadinessDatabase {
  currentWalLsn: () => Promise<string | undefined>;
  replicationStatus: (targetLsn: string) => Promise<{
    activeSlots: number;
    caughtUp: boolean;
  }>;
}

interface ZeroStatzResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}

interface WaitForZeroReadyOptions {
  adminPassword?: string;
  database?: ZeroReadinessDatabase;
  fetcher?: (input: string | URL, init?: RequestInit) => Promise<ZeroStatzResponse>;
  now?: () => number;
  pollIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  statzUrl?: string;
  timeoutMs?: number;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function zeroReplicaCount(source: string) {
  const match = source.match(/numReplicas:\s*\[\s*\{\s*"c"\s*:\s*(\d+)/u);
  return Number(match?.[1] ?? 0);
}

export function zeroReadinessDatabase(sql: E2EDatabase = db()): ZeroReadinessDatabase {
  return {
    async currentWalLsn() {
      const rows = await sql<{ lsn: string }[]>`
        select pg_current_wal_lsn()::text as lsn
      `;
      return rows[0]?.lsn;
    },
    async replicationStatus(targetLsn) {
      const rows = await sql<{ active_slots: number; caught_up: boolean }[]>`
        select
          count(*) filter (where active)::integer as active_slots,
          coalesce(
            bool_or(active and confirmed_flush_lsn >= ${targetLsn}::pg_lsn),
            false
          ) as caught_up
        from pg_replication_slots
        where slot_name like 'zero_%'
      `;
      return {
        activeSlots: Number(rows[0]?.active_slots ?? 0),
        caughtUp: rows[0]?.caught_up ?? false,
      };
    },
  };
}

export async function waitForZeroReady(options: WaitForZeroReadyOptions = {}) {
  const adminPassword = options.adminPassword ?? process.env.ZERO_ADMIN_PASSWORD;
  const database = options.database ?? zeroReadinessDatabase();
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const pollIntervalMs = options.pollIntervalMs ?? ZERO_READY_POLL_INTERVAL_MS;
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const statzUrl = options.statzUrl ?? 'http://127.0.0.1:4848/statz';
  const timeoutMs = options.timeoutMs ?? ZERO_READY_TIMEOUT_MS;
  const deadline = now() + timeoutMs;
  const targetLsn = await database.currentWalLsn();

  if (!targetLsn) {
    throw new Error('Zero readiness could not capture the current PostgreSQL WAL position.');
  }

  let lastDiagnostic = 'readiness probe did not complete';
  while (now() <= deadline) {
    try {
      const response = await fetcher(statzUrl, {
        ...(adminPassword
          ? {
              headers: {
                authorization: `Basic ${Buffer.from(`zero:${adminPassword}`).toString('base64')}`,
              },
            }
          : {}),
        signal: AbortSignal.timeout(ZERO_STATZ_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(
          `Zero statz returned HTTP ${response.status} ${response.statusText}`.trim()
        );
      }

      const replicaCount = zeroReplicaCount(await response.text());
      const replication = await database.replicationStatus(targetLsn);
      lastDiagnostic = `replicas=${replicaCount}, activeSlots=${replication.activeSlots}, caughtUp=${replication.caughtUp}`;
      if (replicaCount > 0 && replication.activeSlots > 0 && replication.caughtUp) {
        console.info(`Zero replica ready (${lastDiagnostic}, targetLsn=${targetLsn}).`);
        return;
      }
    } catch (error) {
      lastDiagnostic = errorMessage(error);
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(pollIntervalMs, remainingMs));
  }

  throw new Error(
    `Zero replica did not become ready within ${timeoutMs}ms (last probe: ${lastDiagnostic}).`
  );
}
