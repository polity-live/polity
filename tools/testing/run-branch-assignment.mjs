import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.resolve(root, 'tools/testing/branch-campaign.assignments.json'), 'utf8')
);

function valuesFor(name) {
  const values = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[++index]);
  }
  return values;
}

const agentId = valuesFor('--agent')[0];
const batch = valuesFor('--batch')[0] ?? 'manual';
const sources = valuesFor('--source').map(file => file.replaceAll('\\', '/'));
const tests = valuesFor('--test').map(file => file.replaceAll('\\', '/'));
const agent = manifest.agents.find(entry => entry.id === agentId);

if (!agent) {
  console.error(
    `Unknown or missing --agent. Expected one of ${manifest.agents.map(entry => entry.id).join(', ')}.`
  );
  process.exit(1);
}
if (!sources.length || !tests.length) {
  console.error('At least one --source and one --test are required.');
  process.exit(1);
}

const owned = new Set(agent.ownedFiles.map(file => file.path));
for (const source of sources) {
  if (!owned.has(source)) {
    console.error(`${agentId} does not own source ${source}.`);
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(root, source))) {
    console.error(`Missing source ${source}.`);
    process.exit(1);
  }
}
const allowedExisting = new Set(agent.allowedExistingTests);
for (const test of tests) {
  const isAgentTest = test.includes(`.branch.${agentId}.test.`);
  const allowedPrefix = agent.allowedTestPrefixes.some(prefix => test.startsWith(prefix));
  if (!(allowedExisting.has(test) || (isAgentTest && allowedPrefix))) {
    console.error(`${agentId} is not allowed to run unregistered test ${test}.`);
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(root, test))) {
    console.error(`Missing test ${test}.`);
    process.exit(1);
  }
}

const artifactRoot =
  process.env.BRANCH_CAMPAIGN_ARTIFACT_DIR ?? path.join(os.tmpdir(), 'polity-branch-campaign');
const reportsDirectory = path.join(
  artifactRoot,
  manifest.baseline.coverageSha256.slice(0, 12),
  agentId,
  batch.replace(/[^a-z0-9_-]/gi, '_')
);
fs.mkdirSync(reportsDirectory, { recursive: true });

const args = [
  'vitest',
  'run',
  '--config',
  'vitest.coverage.config.ts',
  '--project',
  'unit',
  '--project',
  'component',
  '--project',
  'component-flow',
  '--project',
  'service-integration',
  ...tests,
  '--coverage',
  '--coverage.reporter=json-summary',
  `--coverage.reportsDirectory=${reportsDirectory}`,
  '--maxWorkers=1',
  '--reporter=dot',
  ...sources.map(source => `--coverage.include=${source}`),
];
const vitestCli = path.resolve(root, 'node_modules/vitest/vitest.mjs');
if (!fs.existsSync(vitestCli)) {
  console.error(`Vitest CLI missing at ${vitestCli}. Run pnpm install --frozen-lockfile first.`);
  process.exit(1);
}
const result = spawnSync(process.execPath, [vitestCli, ...args.slice(1)], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});
if (result.error) {
  console.error(`Could not start focused Vitest coverage: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const summaryPath = path.join(reportsDirectory, 'coverage-summary.json');
if (!fs.existsSync(summaryPath)) {
  console.error(`Coverage summary missing at ${summaryPath}.`);
  process.exit(1);
}
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const failures = [];
for (const source of sources) {
  const absolute = path.resolve(root, source);
  const entry =
    summary[absolute] ??
    Object.entries(summary).find(([file]) => path.resolve(file) === absolute)?.[1];
  if (!entry) {
    failures.push(`${source}: absent from focused coverage report`);
    continue;
  }
  for (const metric of ['branches', 'lines', 'statements', 'functions']) {
    if (entry[metric].pct !== 100) failures.push(`${source}: ${metric}=${entry[metric].pct}%`);
  }
}
if (failures.length) {
  console.error(
    `Focused assignment coverage failed:\n${failures.map(item => `- ${item}`).join('\n')}`
  );
  process.exit(1);
}
console.info(
  `${agentId} batch ${batch} passed 100% focused coverage. Artifacts: ${reportsDirectory}`
);
