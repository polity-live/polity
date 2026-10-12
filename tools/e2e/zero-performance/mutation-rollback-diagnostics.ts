import assert from 'node:assert/strict';
import postgres, { type Sql } from 'postgres';

export interface RollbackCvrBinding {
  clientGroupID: string | undefined;
  databaseURL: string | undefined;
  cvrDatabaseURL: string | undefined;
  appID: string;
  shardNum: string;
}
interface CvrRowDiagnostic {
  status: 'complete' | 'unavailable' | 'failed' | 'timed-out';
  /** Persisted CVR state, which can lag the instance version and the client. */
  classification?: 'absent' | 'tombstone' | 'unreferenced' | 'referenced';
  identity?: { clientGroupID: string; schema: ''; table: 'action_right'; rowKey: { id: string } };
  rowVersion?: string;
  patchVersion?: string;
  rowsVersion?: string | null;
  instanceVersion?: string | null;
  refCounts?: Record<string, number> | null;
}

interface InspectorWriter {
  inspector: {
    authenticate?(password: string): Promise<boolean>;
    client: {
      map(): Promise<Map<string, unknown>>;
      queries?(): Promise<unknown[]>;
    };
  };
}
interface ProofRead {
  kind: 'row-select' | 'timestamp-select';
  table: string;
  id: string;
  column?: string;
  at: number;
  rowCount: number;
  microseconds?: string[];
}
export interface RollbackFailureDiagnostic {
  assertion: {
    proof: string;
    origin: 'row-select' | 'timestamp-select' | 'unknown';
    frames: string[];
  };
  inspector: {
    snapshot: number;
    at: number;
    key: string;
    table: string;
    id: string;
    /** Identity, permission scope and numeric timestamps only; no application content. */
    row: Record<string, unknown>;
  } | null;
  reads: ProofRead[];
  queries: Record<string, unknown>[];
  queryInspection: 'complete' | 'unavailable' | 'failed' | 'timed-out';
  cvrRow?: CvrRowDiagnostic;
}

const safeVersion = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]+(?::[a-z0-9]+)?$/.test(value);

/** Both pinned SDKs store physical action_right rows with schema='', rowKey={id}.
 * Use the isolated runner's declared binding only when it agrees with the fixture
 * connection. Never inspect catalogs or infer another database/schema/key shape.
 */
async function inspectCvrRow(
  fixture: Sql,
  captured: RollbackFailureDiagnostic['inspector'],
  binding: RollbackCvrBinding | undefined,
  connect: typeof postgres
): Promise<CvrRowDiagnostic> {
  if (
    !captured ||
    captured.table !== 'action_right' ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(captured.id) ||
    !binding?.clientGroupID ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(binding.clientGroupID) ||
    !binding.databaseURL ||
    binding.databaseURL !== binding.cvrDatabaseURL ||
    !/^[a-z0-9_]{1,63}$/.test(binding.appID) ||
    !/^(0|[1-9]\d{0,8})$/.test(binding.shardNum)
  )
    return { status: 'unavailable' };
  try {
    const endpoint = new URL(binding.databaseURL);
    const options = fixture.options;
    if (
      !['postgres:', 'postgresql:'].includes(endpoint.protocol) ||
      endpoint.search ||
      endpoint.hash ||
      options?.host.length !== 1 ||
      options.host[0] !== endpoint.hostname ||
      options.port.length !== 1 ||
      options.port[0] !== Number(endpoint.port || 5432) ||
      options.database !== decodeURIComponent(endpoint.pathname.slice(1)) ||
      options.user !== decodeURIComponent(endpoint.username) ||
      options.pass !== decodeURIComponent(endpoint.password)
    )
      return { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
  let connection: Sql | undefined;
  let pending: ReturnType<Sql['unsafe']> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Startup parameters apply before the sole SELECT; never SET on the fixture
    // connection or leave a borrowed transaction running after a diagnostic timeout.
    connection = connect(binding.databaseURL, {
      max: 1,
      prepare: false,
      connect_timeout: 1,
      onnotice: () => undefined,
      connection: {
        application_name: 'rollback-cvr-diagnostic',
        default_transaction_read_only: true,
        statement_timeout: 750,
      },
    });
    const schema = `"${binding.appID}_${binding.shardNum}/cvr"`;
    pending = connection.unsafe(
      `SELECT r."clientGroupID", r."rowKey", r."rowVersion", r."patchVersion", r."refCounts",
              rv.version AS "rowsVersion", i.version AS "instanceVersion"
         FROM (SELECT $1::text AS "clientGroupID", $2::jsonb AS "rowKey") wanted
         LEFT JOIN ${schema}.rows r ON r."clientGroupID" = wanted."clientGroupID"
          AND r.schema = '' AND r.table = 'action_right' AND r."rowKey" = wanted."rowKey"
         LEFT JOIN ${schema}."rowsVersion" rv ON rv."clientGroupID" = wanted."clientGroupID"
         LEFT JOIN ${schema}.instances i ON i."clientGroupID" = wanted."clientGroupID"`,
      [binding.clientGroupID, { id: captured.id }]
    );
    const result = await Promise.race([
      pending,
      new Promise<undefined>(resolve => {
        timer = setTimeout(() => resolve(undefined), 1_000);
      }),
    ]);
    if (!result) {
      pending.cancel();
      return { status: 'timed-out' };
    }
    if (result.length !== 1) return { status: 'failed' };
    const row = result[0];
    if (
      (row.rowsVersion !== null && !safeVersion(row.rowsVersion)) ||
      (row.instanceVersion !== null && !safeVersion(row.instanceVersion))
    )
      return { status: 'failed' };
    const identity = {
      clientGroupID: binding.clientGroupID,
      schema: '' as const,
      table: 'action_right' as const,
      rowKey: { id: captured.id },
    };
    const versions = { rowsVersion: row.rowsVersion, instanceVersion: row.instanceVersion };
    if (row.clientGroupID === null)
      return { status: 'complete', identity, ...versions, classification: 'absent' };
    if (
      row.clientGroupID !== binding.clientGroupID ||
      !row.rowKey ||
      Object.keys(row.rowKey).length !== 1 ||
      row.rowKey.id !== captured.id ||
      !safeVersion(row.rowVersion) ||
      !safeVersion(row.patchVersion)
    )
      return { status: 'failed' };
    const refs = row.refCounts;
    if (
      refs !== null &&
      (typeof refs !== 'object' ||
        Array.isArray(refs) ||
        Object.entries(refs).some(
          ([hash, count]) =>
            !/^[a-z0-9]{1,64}$/.test(hash) ||
            typeof count !== 'number' ||
            !Number.isSafeInteger(count) ||
            count < 0
        ))
    )
      return { status: 'failed' };
    return {
      status: 'complete',
      identity,
      ...versions,
      rowVersion: row.rowVersion,
      patchVersion: row.patchVersion,
      refCounts: refs === null ? null : Object.fromEntries(Object.entries(refs)),
      classification:
        refs === null
          ? 'tombstone'
          : Object.values(refs).some(count => (count as number) > 0)
            ? 'referenced'
            : 'unreferenced',
    };
  } catch {
    // No server message, connection URL, credentials or application content is exported.
    return { status: 'failed' };
  } finally {
    clearTimeout(timer);
    // end({timeout:0}) destroys this dedicated connection, including queued work.
    // Observe close rejection without allowing cleanup to replace the original result.
    if (connection) await connection.end({ timeout: 0 }).catch(() => undefined);
  }
}

const identityFields = new Set([
  'id',
  'role_id',
  'group_id',
  'event_id',
  'blog_id',
  'amendment_id',
]);
function inspectorRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([field, entry]) =>
        (identityFields.has(field) && typeof entry === 'string') ||
        (['action', 'resource'].includes(field) &&
          typeof entry === 'string' &&
          /^[A-Za-z_]+$/.test(entry)) ||
        (field.endsWith('_at') && typeof entry === 'number' && Number.isFinite(entry))
    )
  );
}
function assertionProof(error: unknown) {
  if (!(error instanceof assert.AssertionError)) return undefined;
  const proof = error.message.split('\n')[0];
  return /^Rollback (row|field) proof: [A-Za-z_]+(?:\.[A-Za-z_]+)?$/.test(proof)
    ? proof
    : undefined;
}

/** Observe the revision's existing reads without changing its assertions or issuing queries.
 * Diagnostics are retained on the original assertion object, including when the common
 * rollback waiter eventually rejects with an earlier mismatch at its original deadline.
 */
export function rollbackDiagnostics(sql: Sql, connect: typeof postgres = postgres) {
  const identifiers = new WeakMap<object, string>();
  const failures = new WeakMap<Error, RollbackFailureDiagnostic>();
  type ForwardedMethod = (...args: never[]) => unknown;
  const methods = new WeakMap<
    object,
    Map<PropertyKey, { original: ForwardedMethod; bound: ForwardedMethod }>
  >();
  function forward(target: object, property: PropertyKey) {
    const value = Reflect.get(target, property, target);
    if (typeof value !== 'function') return value;
    let bindings = methods.get(target);
    if (!bindings) {
      bindings = new Map();
      methods.set(target, bindings);
    }
    const method = bindings.get(property);
    if (method && method.original === value) return method.bound;
    const original = value as ForwardedMethod;
    const bound = original.bind(target);
    bindings.set(property, { original, bound });
    return bound;
  }
  let active = false;
  let snapshot = 0;
  let snapshotAt = 0;
  let rows = new Map<string, { key: string; row: Record<string, unknown> }>();
  let reads: ProofRead[] = [];
  let latest: ProofRead | undefined;
  function identifier(value: unknown) {
    return value && typeof value === 'object' ? identifiers.get(value) : undefined;
  }
  const tracedSQL = new Proxy<Sql>(sql, {
    get: forward,
    apply(target, receiver, args) {
      const pending = Reflect.apply(target, receiver, args);
      if (typeof args[0] === 'string' && /^[A-Za-z_]+$/.test(args[0])) {
        if (pending && typeof pending === 'object') identifiers.set(pending, args[0]);
        return pending;
      }
      if (!active || !Array.isArray(args[0])) return pending;
      const parts = args[0] as string[];
      let read: Omit<ProofRead, 'at' | 'rowCount' | 'microseconds'> | undefined;
      if (parts.join('?') === 'select * from ? where id = ?') {
        const table = identifier(args[1]);
        if (table && typeof args[2] === 'string') read = { kind: 'row-select', table, id: args[2] };
      } else if (
        parts.join('?') ===
        'select (extract(epoch from ?) * 1000000 - 946684800000000)::bigint::text as microseconds from ? where id = ?'
      ) {
        const column = identifier(args[1]);
        const table = identifier(args[2]);
        if (column && table && typeof args[3] === 'string')
          read = { kind: 'timestamp-select', table, column, id: args[3] };
      }
      if (
        !read ||
        !pending ||
        typeof pending !== 'object' ||
        !('then' in pending) ||
        typeof pending.then !== 'function'
      )
        return pending;
      const observedRead = read;
      // Preserve the PendingQuery and its lazy execution. Observe only the same
      // then() the oracle awaits; do not attach a second eager query subscriber.
      return new Proxy(pending, {
        get(query, property) {
          if (property !== 'then') return forward(query, property);
          return (resolve?: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
            query.then((result: unknown[]) => {
              if (active) {
                latest = {
                  ...observedRead,
                  at: performance.now(),
                  rowCount: result.length,
                  ...(observedRead.kind === 'timestamp-select'
                    ? {
                        microseconds: result
                          .map(value => (value as { microseconds?: unknown }).microseconds)
                          .filter(
                            (value): value is string =>
                              typeof value === 'string' && /^-?\d+$/.test(value)
                          ),
                      }
                    : {}),
                };
                reads.push(latest);
              }
              return resolve ? resolve(result) : result;
            }, reject);
        },
      });
    },
  });
  function writerProxy(writer: InspectorWriter) {
    // Preserve the revision callback's own missing-inspector assertion (and
    // callbacks which do not use Inspector), instead of failing in the observer.
    if (typeof writer?.inspector?.client?.map !== 'function') return writer;
    const client = new Proxy(writer.inspector.client, {
      get(target, property) {
        if (property !== 'map') return forward(target, property);
        return async () => {
          const result = await target.map();
          if (active) {
            snapshot++;
            snapshotAt = performance.now();
            rows = new Map();
            for (const [key, value] of result) {
              if (!key.startsWith('e/')) continue;
              const row = inspectorRow(value);
              if (typeof row.id === 'string')
                rows.set(`${key.split('/')[1]}/${row.id}`, { key, row });
            }
            reads = [];
            latest = undefined;
          }
          return result;
        };
      },
    });
    return new Proxy(writer, {
      get(target, property) {
        if (property !== 'inspector') return forward(target, property);
        return new Proxy(target.inspector, {
          get(inspector, field) {
            return field === 'client' ? client : forward(inspector, field);
          },
        });
      },
    });
  }
  return {
    sql: tracedSQL,
    async verify(writer: unknown, verify: (writer: unknown) => Promise<void>) {
      active = true;
      try {
        await verify(writerProxy(writer as InspectorWriter));
      } catch (error) {
        const proof = assertionProof(error);
        if (proof && error instanceof Error) {
          const frames = [
            ...(error.stack ?? '').matchAll(
              /(mutation-(?:cases-governance-revocation|timestamp)\.(?:ts|js):\d+:\d+)/g
            ),
          ].map(match => match[1]);
          const failedRead = latest;
          const row = failedRead && rows.get(`${failedRead.table}/${failedRead.id}`);
          failures.set(
            error,
            structuredClone({
              assertion: {
                proof,
                origin: frames.some(frame => frame.startsWith('mutation-timestamp.'))
                  ? 'timestamp-select'
                  : frames.some(frame => frame.startsWith('mutation-cases-governance-revocation.'))
                    ? 'row-select'
                    : 'unknown',
                frames,
              },
              inspector:
                failedRead && row
                  ? {
                      snapshot,
                      at: snapshotAt,
                      key: row.key,
                      table: failedRead.table,
                      id: failedRead.id,
                      row: row.row,
                    }
                  : null,
              reads: failedRead
                ? reads.filter(read => read.table === failedRead.table && read.id === failedRead.id)
                : [],
              queries: [],
              queryInspection: 'unavailable',
            } as RollbackFailureDiagnostic)
          );
        }
        throw error;
      } finally {
        active = false;
      }
    },
    async failure(
      error: unknown,
      writer: unknown,
      password: string | undefined,
      binding?: RollbackCvrBinding
    ) {
      active = false;
      const retained = error instanceof Error ? failures.get(error) : undefined;
      if (!retained) return undefined;
      const diagnostic = structuredClone(retained);
      diagnostic.cvrRow = await inspectCvrRow(sql, diagnostic.inspector, binding, connect);
      const local = writer as InspectorWriter;
      if (!password || !local?.inspector?.authenticate || !local.inspector.client?.queries)
        return diagnostic;
      const authenticate = local.inspector.authenticate.bind(local.inspector);
      const queryMetadata = local.inspector.client.queries.bind(local.inspector.client);
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;
      try {
        await Promise.race([
          (async () => {
            const authenticated = await authenticate(password);
            if (stopped) return;
            if (!authenticated) throw new Error('Authentication failed');
            const queries = await queryMetadata();
            if (stopped) return;
            diagnostic.queries = queries.map(query => {
              const q = query as Record<string, unknown>;
              return Object.fromEntries(
                ['id', 'name', 'got', 'ttl', 'inactivatedAt', 'rowCount', 'deleted'].map(field => [
                  field,
                  q[field],
                ])
              );
            });
            diagnostic.queryInspection = 'complete';
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              diagnostic.queryInspection = 'timed-out';
              reject(new Error('Diagnostic deadline'));
            }, 1_000);
          }),
        ]);
      } catch {
        if (diagnostic.queryInspection !== 'timed-out') diagnostic.queryInspection = 'failed';
      } finally {
        stopped = true;
        clearTimeout(timer);
      }
      return diagnostic;
    },
  };
}
