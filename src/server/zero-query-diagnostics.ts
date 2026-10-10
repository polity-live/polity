import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const requests = new AsyncLocalStorage<{ id: string; clientCorrelationID?: string }>();
const isUUID = (value: string | null | undefined): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

/** Counts the public QueryResponse AST without writing predicates or argument values. */
export function queryStructure(ast: unknown) {
  let queries = 0;
  let conditions = 0;
  let maxQueryDepth = 0;
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(child => visit(child, depth));
      return;
    }
    const node = value as Record<string, unknown>;
    if (typeof node.table === 'string') {
      queries++;
      depth++;
      maxQueryDepth = Math.max(depth, maxQueryDepth);
    }
    if (['and', 'or', 'simple', 'correlatedSubquery'].includes(String(node.type))) conditions++;
    Object.values(node).forEach(child => visit(child, depth));
  };
  visit(ast, 0);
  return { bytes: Buffer.byteLength(JSON.stringify(ast)), queries, conditions, maxQueryDepth };
}

export function queryDiagnostic(
  phase: string,
  started: number,
  details: Record<string, unknown> = {}
) {
  if (process.env.ZERO_PERFORMANCE_DIAGNOSTICS !== '1') return;
  console.info(
    JSON.stringify({
      benchmark: 'query-api',
      requestID: requests.getStore()?.id,
      clientCorrelationID: requests.getStore()?.clientCorrelationID,
      phase,
      at: Date.now(),
      elapsed: performance.now() - started,
      ...details,
    })
  );
}

export async function withQueryDiagnostics<T>(
  run: () => Promise<T>,
  request?: Pick<Request, 'headers'>
): Promise<T> {
  if (process.env.ZERO_PERFORMANCE_DIAGNOSTICS !== '1') return run();
  const externalID = request?.headers.get('x-zero-performance-request-id');
  const id = isUUID(externalID) ? externalID : randomUUID();
  const externalClientID = request?.headers.get('x-zero-performance-client-id');
  const clientCorrelationID = isUUID(externalClientID) ? externalClientID : undefined;
  return requests.run({ id, clientCorrelationID }, async () => {
    queryDiagnostic('handler', performance.now());
    const started = performance.now();
    try {
      return await run();
    } finally {
      queryDiagnostic('request', started);
    }
  });
}
