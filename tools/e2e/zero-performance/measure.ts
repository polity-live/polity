import { required } from './required';
import { mkdir, readFile, writeFile, appendFile, stat } from 'node:fs/promises';
import { writeAtomicReport } from './atomic-report';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { Zero } from '@rocicorp/zero';
import { schema } from '../../../src/zero/schema';
import { actorUser, ensureE2EAuthUser } from '../../../e2e/fixtures/auth';
import { getLocalActorAccessToken } from '../../../e2e/fixtures/domains/datasets';
import { closeDb } from '../../../e2e/fixtures/db';
import { waitForZeroReady } from '../../../e2e/fixtures/zero-readiness';
import { buildQuery, loadCases, OWNER, OUTSIDER, type BenchmarkCase } from './catalog';
import { Fixtures } from './fixtures';
import { expectedRootIDs, queryAST, resultIDs, relatedResultIDs } from './oracle';
import { BUDGETS, REPETITIONS, checkBudgets, type Measurement } from './metrics';
import { measureJourneys } from './journeys';
import {
  securityScenarios,
  securityCaseManifest,
  type RelatedExpectation,
  type SecurityCaseExpectation,
} from './security';
import {
  REPORT_FORMAT,
  MEASUREMENT_PROTOCOL,
  correlateQueryAPI,
  measuredServerWarnings,
} from './report';
import { writeJoinPlanArtifact } from './plan-artifacts';
import { measurementSummary, resultsCSV } from './results';
import { executionMetadata } from './execution';
import { selectKeys, securityKey } from './sharding';

(globalThis as any).TESTING ??= false;

const output = required(process.env.ZERO_PERFORMANCE_OUTPUT);
const execution = await executionMetadata();
const securitySelection: string[] | undefined = process.env.ZERO_PERFORMANCE_SECURITY_SELECTION
  ? JSON.parse(await readFile(process.env.ZERO_PERFORMANCE_SECURITY_SELECTION, 'utf8'))
  : undefined;
const logOutput = process.env.ZERO_PERFORMANCE_LOG_OUTPUT ?? output;
const planOutput = process.env.ZERO_PERFORMANCE_PLAN_OUTPUT ?? output;
const runtime = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  zero: JSON.parse(await readFile('node_modules/@rocicorp/zero/package.json', 'utf8')).version,
  lockSHA256: createHash('sha256')
    .update(await readFile('pnpm-lock.yaml'))
    .digest('hex'),
  schemaTables: Object.keys(schema.tables).length,
};
const sql = postgres(required(process.env.E2E_DATABASE_URL), {
  max: 2,
  prepare: false,
  onnotice: () => undefined,
});
const fixtures = new Fixtures(sql);
const contexts = { owner: OWNER, outsider: OUTSIDER, anonymous: { userID: 'anon', email: '' } };
const tokens: Partial<Record<keyof typeof contexts, string>> = {};
const results: Measurement[] = [];
const infrastructure: string[] = [];
const layer = process.env.ZERO_PERFORMANCE_LAYER ?? 'all';
const failFast =
  process.env.ZERO_PERFORMANCE_FAIL_FAST === '1' ||
  (layer === 'all' && process.env.ZERO_PERFORMANCE_COLLECT_ALL !== '1');
const selection: string[] | undefined = process.env.ZERO_PERFORMANCE_SELECTION
  ? JSON.parse(await readFile(process.env.ZERO_PERFORMANCE_SELECTION, 'utf8'))
  : undefined;
let expectedKeys: string[] = [];
let expectedSecurityCases: SecurityCaseExpectation[] = [];
const diagnostics: Record<string, unknown> = {};

function benchmarkActor(name: 'owner' | 'outsider') {
  return {
    ...actorUser(`zero-performance-${name}`),
    id: contexts[name].userID,
    email: contexts[name].email,
  };
}
async function refreshToken(actor: keyof typeof contexts) {
  if (actor === 'anonymous') return;
  const current = tokens[actor];
  if (current) {
    const claims = JSON.parse(Buffer.from(current.split('.')[1], 'base64url').toString());
    if (claims.sub !== contexts[actor].userID || !Number.isFinite(claims.exp))
      throw new Error('Invalid benchmark token identity or expiry');
    if (claims.exp * 1_000 > Date.now() + 60_000) return;
  }
  // Long complete suites outlive one JWT. Refresh during connection setup, before activation.
  tokens[actor] = await getLocalActorAccessToken(benchmarkActor(actor));
}

function deadline<T>(promise: Promise<T>, label: string, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}
const clientCorrelations = new WeakMap<object, string>();
async function client(actor: keyof typeof contexts, warnings: string[]) {
  await refreshToken(actor);
  const context = contexts[actor];
  const clientCorrelationID = randomUUID();
  const zero = new Zero({
    schema,
    context,
    ...(actor === 'anonymous' ? {} : { userID: context.userID }),
    auth: tokens[actor],
    cacheURL: required(process.env.VITE_ZERO_CACHE_URL),
    queryURL: `${process.env.VITE_ZERO_API_URL ?? process.env.VITE_APP_URL}/api/query`,
    // Public forwarding option: identifies this fresh client without depending
    // on synchronized wall clocks or changing any Zero implementation.
    queryHeaders: { 'x-zero-performance-client-id': clientCorrelationID },
    kvStore: 'mem',
    storageKey: `benchmark-${randomUUID()}`,
    logLevel: 'warn',
    logSink: {
      log(level, _context, ...args) {
        const message = args
          .map(value => (typeof value === 'string' ? value : JSON.stringify(value)))
          .join(' ');
        if (level === 'warn' && /Slow query/i.test(message)) warnings.push(message);
      },
    },
  });
  clientCorrelations.set(zero, clientCorrelationID);
  try {
    if (zero.connection.state.current.name !== 'connected') {
      await deadline(
        new Promise<void>((resolve, reject) => {
          const unsubscribe = zero.connection.state.subscribe(state => {
            if (state.name === 'connected') {
              unsubscribe();
              resolve();
            }
            if (['error', 'needs-auth', 'closed'].includes(state.name)) {
              unsubscribe();
              reject(new Error(`Zero connection: ${JSON.stringify(state)}`));
            }
          });
        }),
        'Zero connection'
      );
    }
    if (
      !(await deadline(
        zero.inspector.authenticate(required(process.env.ZERO_ADMIN_PASSWORD)),
        'Inspector authentication'
      ))
    )
      throw new Error('Inspector authentication rejected');
    return zero;
  } catch (error) {
    await zero.close();
    throw error;
  }
}

async function measure(
  entry: BenchmarkCase,
  profile: string,
  actor: keyof typeof contexts,
  anchor?: string,
  fixedExpected?: string[],
  related?: RelatedExpectation
) {
  const query = buildQuery(entry, contexts[actor]);
  const ast = queryAST(query);
  const expected = fixedExpected ?? (await expectedRootIDs(sql, ast, fixtures.columns));
  if (profile === 'minimal' && actor === 'owner' && entry.variant !== 'next-page') {
    assert.ok(
      anchor && expected.includes(anchor),
      `${entry.name}: positive fixture must return its anchor (${anchor}); expected=${JSON.stringify(expected)}`
    );
  }
  const measurement: Measurement = {
    execution,
    key: `${entry.name}/${entry.variant}/${profile}/${actor}`,
    name: entry.name,
    variant: entry.variant,
    profile,
    actor,
    revision: entry.revision,
    reason: entry.reason,
    args: entry.noArgs ? null : entry.args,
    expectedIDs: expected,
    observedIDs: [],
    samples: [],
    analyzeMs: [],
    readRows: NaN,
    scannedRows: NaN,
    syncedRows: NaN,
    plans: null,
    warnings: [],
    failures: [],
    ...(related
      ? { relatedChecks: { rootID: related.rootID, expected: related.relations, observed: [] } }
      : {}),
  };
  results.push(measurement);
  await refreshToken(actor);
  // Only idle connection setup overlaps. Query activation and analysis stay sequential.
  const connections = await Promise.allSettled(
    Array.from({ length: REPETITIONS.materialize }, async () => {
      const connectionAt = performance.now();
      const zero = await client(actor, measurement.warnings);
      try {
        const clientGroupID = await deadline(zero.clientGroupID, 'Client group identity');
        return { zero, clientGroupID, connectionMs: performance.now() - connectionAt };
      } catch (error) {
        await deadline(zero.close(), 'Closing failed connection');
        throw error;
      }
    })
  );
  let analyze: (() => Promise<void>) | undefined;
  let releaseAnalysisView: (() => void) | undefined;
  try {
    for (let iteration = 0; iteration < REPETITIONS.materialize; iteration++) {
      let zero: Awaited<ReturnType<typeof client>> | undefined;
      let view:
        | {
            addListener: (
              listener: (data: unknown, type: string, error?: unknown) => void
            ) => unknown;
            destroy: () => void;
          }
        | undefined;
      try {
        const connection = connections[iteration];
        if (connection.status === 'rejected') throw connection.reason;
        const { clientGroupID, connectionMs } = connection.value;
        zero = connection.value.zero;
        const activatedAt = Date.now();
        const start = performance.now();
        view = zero.materialize(
          entry.noArgs ? (entry.query as any)() : (entry.query as any)(entry.args),
          { ttl: 'none' }
        );
        const data = await deadline(
          new Promise<unknown>((resolve, reject) => {
            required(view).addListener((data, type, error) => {
              if (type === 'complete') resolve(data);
              if (type === 'error') reject(new Error(`Query rejected: ${JSON.stringify(error)}`));
            });
          }),
          measurement.key
        );
        const elapsed = performance.now() - start;
        measurement.observedIDs.push(resultIDs(data, ast.table));
        if (related) {
          const roots = Array.isArray(data) ? data : data ? [data] : [];
          const root = roots.find(row => row.id === related.rootID);
          assert.ok(root, 'Missing root for independent related-result check');
          const observed = Object.fromEntries(
            Object.keys(related.relations).map(relation => [
              relation,
              relatedResultIDs(root, relation),
            ])
          );
          required(measurement.relatedChecks).observed.push(observed);
          assert.deepEqual(observed, related.relations, 'Unexpected authorized related results');
        }
        assert.deepEqual(
          resultIDs(data, ast.table),
          expected,
          `${measurement.key}: unexpected authoritative result`
        );
        const inspection = await deadline(zero.inspector.client.queries(), 'Query metrics');
        const stats = inspection.find(item => item.name === entry.name);
        if (
          !stats ||
          stats.hydrateClient == null ||
          stats.hydrateServer == null ||
          stats.hydrateTotal == null
        )
          throw new Error('Missing client/server/total hydration metrics');
        measurement.samples.push({
          clientCorrelationID: required(clientCorrelations.get(zero)),
          queryID: stats.id,
          activatedAt,
          authoritativeAt: activatedAt + elapsed,
          totalMs: Math.max(elapsed, stats.hydrateTotal),
          clientMs: stats.hydrateClient,
          serverMs: stats.hydrateServer,
          clientGroupID,
          clientID: zero.clientID,
          connectionMs,
        });
        if (iteration === 0) {
          // Retain this real view for analysis, but complete every fresh-client
          // timing before any analyzer or join-plan export can load the stack.
          releaseAnalysisView = view.destroy.bind(view);
          view = undefined;
          analyze = async () => {
            for (let repeat = 0; repeat < REPETITIONS.warmup + REPETITIONS.analyze; repeat++) {
              const analyzed = await deadline(
                stats.analyze({ joinPlans: false }),
                'Query analyzer'
              );
              if (
                analyzed.elapsed == null ||
                analyzed.readRowCount == null ||
                analyzed.dbScansByQuery == null ||
                analyzed.sqlitePlans == null
              )
                throw new Error('Incomplete analyzer result');
              if (repeat >= REPETITIONS.warmup) measurement.analyzeMs.push(analyzed.elapsed);
              measurement.readRows = analyzed.readRowCount;
              const scanCounts = Object.values(analyzed.dbScansByQuery).flatMap(counts =>
                Object.values(counts)
              );
              if (scanCounts.some(count => !Number.isFinite(count) || count < 0))
                measurement.failures.push('Analyzer returned unavailable or invalid scan counts');
              measurement.scannedRows = Object.values(analyzed.dbScansByQuery).reduce(
                (sum, counts) => sum + Object.values(counts).reduce((s, n) => s + n, 0),
                0
              );
              measurement.syncedRows = analyzed.syncedRowCount;
              measurement.plans = {
                sqlite: analyzed.sqlitePlans,
                joins: analyzed.joinPlans,
                scansByQuery: analyzed.dbScansByQuery,
                readsByQuery: analyzed.readRowCountsByQuery,
                serverZQL: stats.serverZQL,
                clientZQL: stats.clientZQL,
              };
              measurement.warnings.push(...analyzed.warnings.filter(w => /Slow query/i.test(w)));
            }
            // Export the expensive join trace once, after the diagnostic analysis.
            // Timings remain the unmodified elapsed values from Zero's analyzer.
            const exportAt = performance.now();
            const exported = await deadline(
              stats.analyze({ joinPlans: true }),
              'Query plan export'
            );
            if (exported.joinPlans == null || exported.sqlitePlans == null)
              throw new Error('Incomplete query plan export');
            measurement.plans = {
              ...(measurement.plans as Record<string, unknown>),
              sqlite: exported.sqlitePlans,
              joins: exported.joinPlans,
              exportMs: performance.now() - exportAt,
              exportMode: 'separate',
            };
            measurement.warnings.push(...exported.warnings.filter(w => /Slow query/i.test(w)));
          };
        }
      } catch (error) {
        measurement.failures.push(error instanceof Error ? error.message : String(error));
        if (failFast) break;
      } finally {
        view?.destroy();
      }
    }
    if (analyze) {
      try {
        await analyze();
      } catch (error) {
        measurement.failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    releaseAnalysisView?.();
    const closing = await Promise.allSettled(
      connections.map(connection =>
        connection.status === 'fulfilled'
          ? deadline(connection.value.zero.close(), 'Closing benchmark client')
          : Promise.resolve()
      )
    );
    for (const result of closing)
      if (result.status === 'rejected') measurement.failures.push(String(result.reason));
  }
  // API log correlation occurs after collection; progress is never a gate report.
  measurement.failures = checkBudgets(measurement, false);
  const plans = measurement.plans as { joins?: unknown[]; joinsArtifact?: unknown };
  if (Array.isArray(plans?.joins)) {
    plans.joinsArtifact = await writeJoinPlanArtifact(planOutput, measurement.key, plans.joins);
    delete plans.joins;
  }
  console.info(
    JSON.stringify({
      key: measurement.key,
      ...measurementSummary(measurement),
      failures: measurement.failures,
    })
  );
  await appendFile(path.join(output, 'measurements.ndjson'), JSON.stringify(measurement) + '\n');
  await save();
}

async function save(extra: Record<string, unknown> = {}, final = false) {
  Object.assign(diagnostics, extra);
  if (final) {
    const log = await readFile(path.join(logOutput, 'app.log'), 'utf8');
    diagnostics.apiDiagnostics = log.split('\n').flatMap(line => {
      const start = line.search(/\{"benchmark":"query-(?:api|http)"/);
      if (start < 0) return [];
      try {
        return [JSON.parse(line.slice(start))];
      } catch {
        infrastructure.push('Invalid query API diagnostic record');
        return [];
      }
    });
    correlateQueryAPI(results, diagnostics.apiDiagnostics as any[]);
    for (const result of results) result.failures = checkBudgets(result);
    await writeFile(
      path.join(output, 'measurements.ndjson'),
      results.map(result => JSON.stringify(result)).join('\n') + (results.length ? '\n' : '')
    );
  }
  await mkdir(output, { recursive: true });
  const target = path.join(output, final ? 'report.json' : 'progress.json');
  await writeAtomicReport(
    target,
    JSON.stringify(
      {
        format: REPORT_FORMAT,
        protocol: MEASUREMENT_PROTOCOL,
        execution,
        runtime,
        budgets: BUDGETS,
        repetitions: REPETITIONS,
        layer: process.env.ZERO_PERFORMANCE_LAYER ?? 'all',
        expectedKeys,
        expectedSecurityCases,
        filtered: Boolean(
          process.env.ZERO_PERFORMANCE_QUERY || process.env.ZERO_PERFORMANCE_CASE || selection
        ),
        queryCount: new Set(results.map(r => r.name)).size,
        infrastructure,
        ...(final
          ? { measurements: results }
          : {
              measurementsCount: results.length,
              lastMeasurement: results.at(-1)?.key,
              lastFailures: results.at(-1)?.failures,
            }),
        ...diagnostics,
      },
      null,
      2
    )
  );
}

try {
  const all = loadCases();
  expectedSecurityCases = selectKeys(await securityCaseManifest(), securitySelection);
  if (selection?.some(key => !all.some(entry => `${entry.name}/${entry.variant}` === key)))
    throw new Error('Confirmation selection includes an unregistered query case');
  const entries = all.filter(
    entry =>
      (!selection || selection.includes(`${entry.name}/${entry.variant}`)) &&
      (!process.env.ZERO_PERFORMANCE_QUERY || entry.name === process.env.ZERO_PERFORMANCE_QUERY) &&
      (!process.env.ZERO_PERFORMANCE_CASE ||
        `${entry.variant}` === process.env.ZERO_PERFORMANCE_CASE)
  );
  if (!entries.length) throw new Error('No matching query/case; refusing a vacuous success');
  expectedKeys = entries.flatMap(entry =>
    ['empty/owner', 'minimal/owner', 'minimal/outsider', 'minimal/anonymous'].map(
      suffix => `${entry.name}/${entry.variant}/${suffix}`
    )
  );
  for (const [name, context] of Object.entries({ owner: OWNER, outsider: OUTSIDER }) as [
    keyof typeof tokens,
    typeof OWNER,
  ][]) {
    const actor = {
      ...benchmarkActor(name as 'owner' | 'outsider'),
      id: context.userID,
      email: context.email,
    };
    await ensureE2EAuthUser(actor);
    tokens[name] = await getLocalActorAccessToken(actor);
  }
  await fixtures.inspect();
  await waitForZeroReady();
  const readyAt = new Date().toISOString();
  const logOffset = (await stat(path.join(logOutput, 'zero.log'))).size;
  for (const entry of ['journeys', 'security'].includes(layer) ? [] : entries) {
    // One complete case per profile stays isolated; the previous fixture is removed.
    for (const profile of ['empty', 'minimal']) {
      let anchor: string | undefined;
      try {
        if (profile === 'minimal') anchor = await fixtures.seed(queryAST(buildQuery(entry)));
        await waitForZeroReady();
        await measure(entry, profile, 'owner', anchor);
        if (profile === 'minimal') {
          await measure(entry, profile, 'outsider');
          await measure(entry, profile, 'anonymous');
        }
      } catch (error) {
        infrastructure.push(
          `${entry.name}/${entry.variant}/${profile}: ${error instanceof Error ? error.message : String(error)}`
        );
        console.error(infrastructure.at(-1));
      } finally {
        await fixtures.cleanup();
        await save({ readyAt });
      }
      if (failFast && (infrastructure.length || results.some(result => result.failures.length)))
        throw new Error(
          `Strict gate stopped at ${entry.name}/${entry.variant}/${profile}; remaining cases were not measured and cannot pass coverage`
        );
    }
  }
  let journeys: unknown;
  if (!process.env.ZERO_PERFORMANCE_QUERY && !selection && layer !== 'journeys') {
    await securityScenarios(sql, async (name, variant, args, actor, expected, related) => {
      if (securitySelection && !securitySelection.includes(securityKey(name, variant, actor)))
        return;
      const entry = all.find(c => c.name === name && c.variant === 'default');
      if (!entry) throw new Error(`Security query not registered: ${name}`);
      // Poll the same WAL/replica condition more often before timed activation.
      // Replaying every state and waiting for confirmed replication remain mandatory.
      await waitForZeroReady({ pollIntervalMs: 100 });
      await measure(
        { ...entry, args, variant: `security-${variant}` },
        'security',
        actor,
        undefined,
        expected,
        related
      );
      if (failFast && results.at(-1)?.failures.length)
        throw new Error(`Strict gate stopped at ${name}/security-${variant}`);
    });
  }
  if (['all', 'journeys'].includes(layer) && !process.env.ZERO_PERFORMANCE_QUERY && !selection) {
    journeys = await measureJourneys(records => save({ journeys: records }));
  }
  const warningLog = measuredServerWarnings(
    await readFile(path.join(logOutput, 'zero.log')),
    logOffset
  );
  infrastructure.push(...warningLog.errors);
  // Service startup is excluded via its recorded timestamp; all measurement-phase slow logs fail.
  const measuredSlowLogs = warningLog.warnings;
  if (measuredSlowLogs.length)
    infrastructure.push(`${measuredSlowLogs.length} server slow-query warnings`);
  await save({ readyAt, journeys, serverWarnings: measuredSlowLogs }, true);
  await writeFile(path.join(output, 'results.csv'), resultsCSV(results));
  console.table(
    results.map(result => ({
      ...measurementSummary(result),
      failures: undefined,
      failed: result.failures.length,
    }))
  );
  if (Array.isArray(journeys)) {
    const rows = journeys.map((journey: any) => ({
      route: journey.route,
      visit: journey.visit,
      visibleMs: journey.visibleMs,
      cachedDisplayMs: journey.cachedDisplayMs,
      bootVisibleMs: journey.boot?.visibleMs,
      bootAuthoritativeMs: journey.boot?.authoritativeMs,
      queries: journey.queries.length,
      failures: journey.failures.join('; '),
    }));
    console.table(
      rows.map(({ failures: _failures, ...row }) => ({
        ...row,
        failed: journeys.find(
          (journey: any) => journey.route === row.route && journey.visit === row.visit
        )?.failures.length,
      }))
    );
    await writeFile(
      path.join(output, 'journeys.csv'),
      [
        'route,visit,visibleMs,cachedDisplayMs,bootVisibleMs,bootAuthoritativeMs,queries,failures',
        ...rows.map(row =>
          [
            row.route,
            row.visit,
            row.visibleMs,
            row.cachedDisplayMs ?? '',
            row.bootVisibleMs ?? '',
            row.bootAuthoritativeMs ?? '',
            row.queries,
            row.failures,
          ]
            .map(value => JSON.stringify(value))
            .join(',')
        ),
      ].join('\n')
    );
  }
  if (
    infrastructure.length ||
    results.some(result => result.failures.length) ||
    (Array.isArray(journeys) && journeys.some((j: any) => j.failures.length))
  )
    process.exitCode = 1;
} catch (error) {
  infrastructure.push(error instanceof Error ? error.message : String(error));
  await save({}, true);
  const rows = results.map(item => measurementSummary(item));
  console.table(
    rows.map(({ failures: _failures, ...row }, index) => ({
      ...row,
      failed: results[index].failures.length,
    }))
  );
  await writeFile(path.join(output, 'results.csv'), resultsCSV(results));
  console.error(infrastructure.at(-1));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
  await closeDb();
}
