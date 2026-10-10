import { appendFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { loadCases } from './catalog';
import { securityCaseManifest } from './security';
import { mutationInventory } from './mutation-runtime';
import { createManifest, validateManifest, type Manifest, type Workload } from './sharding';
import {
  command,
  git,
  harnessDigest,
  harnessRoot,
  option,
  readJSON,
  requiredOption,
  writeJSON,
} from './distributed-io';

const action = process.argv[2];
if (action === 'prepare') {
  const started = performance.now();
  const output = path.resolve(requiredOption('--output'));
  const baseline = option('--baseline-ref') ?? process.env.ZERO_PERFORMANCE_BASE_REF;
  const headSHA = git('rev-parse', 'HEAD');
  const head: Workload = {
    queries: loadCases().map(entry => `${entry.name}/${entry.variant}`),
    security: await securityCaseManifest(),
    mutations: (await mutationInventory()).expectations,
  };
  let baseSHA: string | undefined, base: Workload | undefined, bootstrap: string | undefined;
  if (!baseline || /^0+$/.test(baseline))
    bootstrap = 'No baseline commit supplied; full head absolute checks remain mandatory.';
  else {
    baseSHA = git('rev-parse', '--verify', `${baseline}^{commit}`);
    const exists = spawnSync(
      'git',
      ['cat-file', '-e', `${baseSHA}:tools/e2e/zero-performance/measure.ts`],
      { stdio: 'ignore', windowsHide: true }
    );
    if (exists.status !== 0)
      bootstrap = 'Baseline predates the benchmark; full head absolute checks remain mandatory.';
    else {
      const inventoryOutput = path.join(output, 'base-inventory');
      const code = await command([
        'tools/e2e/zero-performance/run.mjs',
        '--inventory-only',
        '--source-ref',
        baseSHA,
        '--harness-root',
        harnessRoot,
        '--output',
        inventoryOutput,
      ]);
      if (code !== 0)
        throw new Error('Cannot inventory the baseline with the identical measurement harness');
      base = await readJSON<Workload>(path.join(inventoryOutput, 'inventory.json'));
    }
  }
  const weights = await readJSON<Record<string, number>>(
    path.join(harnessRoot, 'shard-weights.json')
  );
  const manifest = createManifest(
    {
      protocol: 'zero-performance/v12',
      runID: `${process.env.GITHUB_RUN_ID ?? randomUUID()}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`,
      headSHA,
      baseSHA,
      harnessDigest: await harnessDigest(),
      bootstrap,
      workloads: { head, base },
    },
    weights
  );
  await writeJSON(path.join(output, 'manifest.json'), manifest);
  const jobStart = option('--job-start-file');
  const elapsedMs = jobStart
    ? os.uptime() * 1000 - Number(await readFile(jobStart, 'utf8')) * 1000
    : performance.now() - started;
  await writeJSON(path.join(output, 'prepare.json'), {
    manifestDigest: manifest.digest,
    elapsedMs,
    startedAt: new Date(Date.now() - elapsedMs).toISOString(),
    completedAt: new Date().toISOString(),
  });
  const matrix = {
    include: manifest.shards.map(shard => ({ shard: shard.id, layer: shard.layer })),
  };
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
  console.log(
    JSON.stringify({
      matrix,
      queries: head.queries.length * 4,
      security: head.security.length,
      mutations: head.mutations.length,
      bootstrap,
      elapsedMs,
    })
  );
} else if (action === 'run') {
  const { runShard } = await import('./distributed-runner');
  const manifest = await readJSON<Manifest>(requiredOption('--manifest'));
  validateManifest(manifest);
  await runShard(manifest, requiredOption('--shard'), requiredOption('--output'));
} else if (action === 'merge') {
  const { mergeShards } = await import('./distributed-merge');
  const manifest = await readJSON<Manifest>(requiredOption('--manifest'));
  validateManifest(manifest);
  await mergeShards(manifest, requiredOption('--artifacts'), requiredOption('--output'));
} else throw new Error('Expected prepare, run or merge');
