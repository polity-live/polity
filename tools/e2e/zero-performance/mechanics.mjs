export const mechanics = [
  'run.mjs',
  'collect.ts',
  'measure.ts',
  'query-timeline.ts',
  'authoritative-order-diagnostic.ts',
  'fresh-client-cleanup.ts',
  'metrics.ts',
  'results.ts',
  'browser-navigation.ts',
  'navigation-history-adapter.mjs',
  'navigation-history-diagnostic.ts',
  'navigation-attribution.ts',
  'journey-metrics.ts',
  'report.ts',
  'plan-artifacts.ts',
  'scan-status-artifacts.ts',
  'sqlite-scan-status.mjs',
  'sqlite-scan-preload.mjs',
  'sqlite-scan-native.mjs',
  'atomic-report.ts',
  'batches.ts',
  'required.ts',
  'isolation.mjs',
  'linux-runtime.mjs',
  'linux-browser.mjs',
  'api-timing.mjs',
  'fixture-check.ts',
  'sharding.ts',
  'execution.ts',
  'inventory.ts',
  'mutation-runtime.ts',
  'mutation-case-types.ts',
  'mutation-metrics.ts',
  'mutation-report.ts',
  'mutation-measure.ts',
  'mutation-observation.ts',
  'mutation-snapshot.ts',
  'mutation-rollback-diagnostics.ts',
  'mutation-request-completion.ts',
  'mutation-error-diagnostics.ts',
  'delivery-endpoint.mjs',
  'mutation-browser-metrics.ts',
  'mutation-browser-observation.ts',
  'mutation-browser-observation-adapter.mjs',
  'mechanics.mjs',
];

// Only benchmark adapters are overlaid in application source. Business logic,
// schema, migrations and workload definitions continue to belong to each revision.
export const applicationMechanics = [
  'src/server/zero-mutation-diagnostics.ts',
  'src/server/zero-mutation-delivery.ts',
];
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Shared preparation/runtime binding; retain the original byte order and raw-file hashing. */
export async function mechanicsDigest(directory) {
  const hash = createHash('sha256');
  const files = [
    ...mechanics,
    'distributed.ts',
    'distributed-runner.ts',
    'distributed-merge.ts',
    'distributed-report.ts',
    'distributed-io.ts',
    'distributed-timing.ts',
    'ci-job-timings.ts',
    'absolute-confirmation.ts',
    'shard-weights.json',
    'stage-artifacts.mjs',
  ];
  for (const file of files.sort())
    hash.update(file).update(await readFile(path.join(directory, file)));
  for (const file of applicationMechanics)
    hash.update(file).update(await readFile(path.resolve(directory, '../../..', file)));
  return hash.digest('hex');
}
