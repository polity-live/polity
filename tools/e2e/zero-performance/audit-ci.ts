import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { nativeTiming } from './distributed-timing';
import { requiredOption, writeJSON } from './distributed-io';
import { assertOutputDirectory } from './isolation.mjs';

const output = path.resolve(requiredOption('--output'));
assertOutputDirectory(process.cwd(), output);
const runIDs = requiredOption('--runs').split(',');
if (
  runIDs.length !== 3 ||
  new Set(runIDs).size !== 3 ||
  runIDs.some(id => !/^\d+(?::[1-9]\d*)?$/.test(id))
)
  throw new Error(
    'Acceptance requires three distinct native CI executions (run ID or run ID:attempt)'
  );
const repository = requiredOption('--repository');
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid repository');
await mkdir(output, { recursive: true });
function gh(...args: string[]) {
  const command = process.platform === 'win32' ? 'gh.exe' : 'gh';
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`GitHub read failed: ${result.stderr}`);
  return result.stdout;
}
const runs = [];
for (const execution of runIDs) {
  const [id, attempt] = execution.split(':');
  const run = JSON.parse(
    gh('api', `repos/${repository}/actions/runs/${id}${attempt ? `/attempts/${attempt}` : ''}`)
  );
  if (run.status !== 'completed') throw new Error(`CI run ${id} has not completed`);
  const pages = JSON.parse(
    gh(
      'api',
      '--paginate',
      '--slurp',
      `repos/${repository}/actions/runs/${id}/attempts/${run.run_attempt}/jobs?per_page=100`
    )
  );
  const jobs = pages.flatMap((page: any) => page.jobs);
  const gateJobs = jobs.filter((job: any) => job.name === 'Zero Query Performance');
  if (gateJobs.length !== 1) throw new Error(`CI run ${id} has no unique required gate`);
  const artifact = path.join(output, `${id}-${run.run_attempt}`);
  gh(
    'run',
    'download',
    id,
    '--repo',
    repository,
    '--name',
    `zero-query-performance-${run.run_attempt}`,
    '--dir',
    artifact
  );
  const gate = JSON.parse(await readFile(path.join(artifact, 'gate.json'), 'utf8'));
  if (
    gate.protocol !== 'zero-performance/v10' ||
    gate.runID !== `${id}-${run.run_attempt}` ||
    (run.event !== 'pull_request' && gate.headSHA !== run.head_sha) ||
    !gate.timing.nativeCI
  )
    throw new Error(`CI run ${id} has invalid revision/protocol provenance`);
  const timing = nativeTiming(
    jobs,
    Date.parse(gateJobs[0].completed_at) - Date.parse(gateJobs[0].started_at),
    gate.shardIDs
  );
  const coverageComplete =
    gate.coverage?.failures.length === 0 &&
    (gate.bootstrap || Boolean(gate.sections.base)) &&
    Object.values(gate.sections).every(
      (section: any) =>
        section.catalogExpected === section.catalogMeasured &&
        section.securityExpected === section.securityMeasured &&
        section.browserScenarios === 20
    );
  runs.push({
    runID: id,
    attempt: run.run_attempt,
    url: run.html_url,
    headSHA: gate.headSHA,
    baseSHA: gate.baseSHA,
    bootstrap: gate.bootstrap,
    coverageComplete,
    activeBudgetPassed: !timing.failed,
    functionalPassed: gate.passed && gateJobs[0].conclusion === 'success',
    timing,
    failures: gate.failures,
  });
}
if (new Set(runs.map(run => `${run.runID}:${run.attempt}`)).size !== 3)
  throw new Error('Duplicate resolved CI executions');
if (new Set(runs.map(run => run.headSHA)).size !== 1)
  throw new Error('Acceptance runs must test the same revision');
if (new Set(runs.map(run => JSON.stringify([run.baseSHA, run.bootstrap]))).size !== 1)
  throw new Error('Acceptance runs must use the same baseline/bootstrap');
const result = {
  protocol: 'zero-performance/v10',
  runs,
  threeNativeRunsWithinBudget: runs.every(run => run.coverageComplete && run.activeBudgetPassed),
  fullyGreen: runs.every(run => run.functionalPassed),
};
await writeJSON(path.join(output, 'ci-acceptance.json'), result);
console.log(JSON.stringify(result));
if (!result.threeNativeRunsWithinBudget || !result.fullyGreen) process.exitCode = 1;
