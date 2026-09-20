import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { dbProvider } from '../../src/zero/db-provider';
import { acceptanceGates, sourceFingerprint, schemaFingerprint } from './evidence';

const database = new URL(process.env.ZERO_UPSTREAM_DB || '');
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.port !== '54322')
  throw new Error('This verification runner only operates on the local Polity stack');
const folder = 'output/collaboration-migration/verification';
mkdirSync(folder, { recursive: true });
const source = sourceFingerprint(),
  lockfile = createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex');
const schema = await dbProvider.transaction(tx => schemaFingerprint(tx.dbTransaction));
const reportPath = 'output/collaboration-migration/acceptance.json';
interface Gate {
  status: 'pending' | 'passed' | 'failed';
  command?: string;
  exitCode?: number;
  durationMs?: number;
  log?: string;
  logChecksum?: string;
}
const report = {
  status: 'in_progress',
  source,
  lockfile,
  schema,
  releaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(),
  completedAt: null as string | null,
  gates: Object.fromEntries(acceptanceGates.map(g => [g, { status: 'pending' }])) as Record<
    string,
    Gate
  >,
};
const checks = [
  { gates: ['format'], command: 'pnpm format:check:changed' },
  { gates: ['lint'], command: 'pnpm lint:check' },
  { gates: ['types'], command: 'pnpm typecheck' },
  { gates: ['static'], command: 'pnpm test:static' },
  { gates: ['coverage'], command: 'pnpm test:coverage:ratchet' },
  { gates: ['changed-coverage'], command: 'pnpm test:coverage:changed' },
  { gates: ['browser-components'], command: 'pnpm test:browser-component' },
  { gates: ['security'], command: 'pnpm test:security' },
  { gates: ['build'], command: 'pnpm build' },
  { gates: ['database'], command: 'pnpm test:db' },
  {
    gates: ['multiuser', 'migration', 'exports', 'restart'],
    command: 'pnpm exec playwright test --config playwright.collaboration.config.ts',
  },
];
const selected = process.argv.slice(3);
if (selected.some(g => !acceptanceGates.includes(g as (typeof acceptanceGates)[number])))
  throw new Error('Expected zero or more named acceptance gates');
if (selected.length) {
  try {
    const previous = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (previous.source === source && previous.lockfile === lockfile && previous.schema === schema)
      for (const gate of acceptanceGates)
        if (previous.gates?.[gate]) report.gates[gate] = previous.gates[gate];
  } catch {
    /* A missing report starts with every gate pending. */
  }
}
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));
save();
for (const check of checks.filter(
  c => !selected.length || c.gates.some(g => selected.includes(g))
)) {
  const start = Date.now(),
    log = `${folder}/${check.gates[0]}.log`;
  const fd = openSync(log, 'w');
  console.log(`Checking ${check.gates.join(', ')}: ${check.command}`);
  const exitCode = await new Promise<number>(resolve => {
    // Commands above are fixed repository commands, never caller-provided shell text.
    const child = spawn(check.command, {
      shell: true,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', fd, fd],
    });
    child.once('error', () => resolve(1));
    child.once('exit', code => resolve(code ?? 1));
  });
  closeSync(fd);
  const result: Gate = {
    status: exitCode === 0 ? 'passed' : 'failed',
    command: check.command,
    exitCode,
    durationMs: Date.now() - start,
    log,
    logChecksum: createHash('sha256').update(readFileSync(log)).digest('hex'),
  };
  for (const gate of check.gates) report.gates[gate] = result;
  console.log(`${result.status}: ${check.gates.join(', ')}`);
  save();
}
const currentSchema = await dbProvider.transaction(tx => schemaFingerprint(tx.dbTransaction));
report.status =
  source !== sourceFingerprint() || schema !== currentSchema
    ? 'invalidated'
    : acceptanceGates.every(g => report.gates[g].status === 'passed')
      ? 'passed'
      : 'incomplete';
report.completedAt = new Date().toISOString();
save();
console.log(`Acceptance ${report.status}; ${reportPath}`);
process.exit(report.status === 'passed' ? 0 : 1);
