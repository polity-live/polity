import { appendFile, copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readPerformanceReport } from './plan-artifacts';
import { reportFailures, MEASUREMENT_PROTOCOL, REPORT_FORMAT, type Report } from './report';
import { BUDGETS, REPETITIONS } from './metrics';
import {
  comparisons,
  confirmationFailures,
  confirmationSelection,
  freshGroupFailures,
  partialReportFailures,
  shardMeasurementKeys,
} from './distributed-report';
import {
  ACTIVE_BUDGET_MS,
  coverageFailures,
  executionFailures,
  PROFILE_KEYS,
  type Manifest,
  type Revision,
} from './sharding';
import { activeTiming, nativeTiming } from './distributed-timing';
import {
  git,
  harnessDigest,
  option,
  ownedPath,
  readJSON,
  requiredOption,
  writeJSON,
} from './distributed-io';
import type { ShardResult } from './distributed-runner';
import { resultsCSV } from './results';
import { mutationResultsCSV, externalMutationDelivery } from './mutation-report';

async function ciJobs() {
  if (!process.env.GITHUB_ACTIONS) return undefined;
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID)
    throw new Error('Missing read-only CI timing context');
  const jobs: any[] = [];
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/attempts/${process.env.GITHUB_RUN_ATTEMPT ?? '1'}/jobs?per_page=100&page=${page}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) throw new Error(`Cannot read CI job timings: HTTP ${response.status}`);
    const result: any = await response.json();
    jobs.push(...result.jobs);
    if (result.jobs.length < 100) return jobs;
  }
}

export async function mergeShards(
  manifest: Manifest,
  artifactDirectory: string,
  directory: string
) {
  const started = performance.now();
  const root = path.resolve(directory);
  await mkdir(root, { recursive: true });
  const failures: string[] = [];
  if (
    git('rev-parse', 'HEAD') !== manifest.headSHA ||
    (await harnessDigest()) !== manifest.harnessDigest
  )
    throw new Error('Merge source/harness differs from the preparation manifest');
  const results = new Map<string, { root: string; result: ShardResult }>();
  for (const entry of await readdir(artifactDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runnerRoot = path.join(artifactDirectory, entry.name);
    try {
      const result = await readJSON<ShardResult>(path.join(runnerRoot, 'runner.json'));
      if (
        result.manifestDigest !== manifest.digest ||
        !manifest.shards.some(shard => shard.id === result.shardID) ||
        !result.runnerID ||
        results.has(result.shardID)
      ) {
        failures.push(`Invalid or duplicate runner artifact: ${entry.name}`);
        continue;
      }
      results.set(result.shardID, { root: runnerRoot, result });
    } catch (error) {
      failures.push(`Missing/invalid runner outcome ${entry.name}: ${String(error)}`);
    }
  }
  failures.push(
    ...coverageFailures(
      manifest.shards.map(shard => shard.id),
      [...results.keys()]
    )
  );
  const aggregate: Partial<Record<Revision, Report>> = {};
  for (const revision of ['head', 'base'] as const) {
    const workload = manifest.workloads[revision];
    if (!workload) continue;
    aggregate[revision] = {
      format: REPORT_FORMAT,
      protocol: MEASUREMENT_PROTOCOL,
      layer: 'all',
      filtered: false,
      expectedKeys: workload.queries.flatMap(key =>
        PROFILE_KEYS.map(profile => `${key}/${profile}`)
      ),
      expectedSecurityCases: workload.security,
      expectedMutations: workload.mutations,
      mutationBootstrap: workload.mutationBootstrap,
      mutations: [],
      mutationDiagnostics: [],
      infrastructure: [],
      measurements: [],
      serverWarnings: [],
      apiDiagnostics: [],
      journeys: [],
    };
  }
  const copyPlans = async (report: Report, source: string, revision: Revision) => {
    const destination = path.join(root, revision);
    await mkdir(path.join(destination, 'plans'), { recursive: true });
    for (const measurement of report.measurements) {
      const ref = (measurement.plans as any)?.joinsArtifact;
      if (ref) await copyFile(ownedPath(source, ref.path), ownedPath(destination, ref.path));
    }
  };
  const loadRun = async (
    runner: { root: string; result: ShardResult },
    revision: Revision,
    phase: 'initial' | 'confirmation'
  ) => {
    const matching = runner.result.runs.filter(
      run => run.revision === revision && run.phase === phase
    );
    if (matching.length !== 1) throw new Error(`Missing/duplicate ${revision}/${phase} report`);
    const run = matching[0];
    const source = ownedPath(runner.root, run.output);
    return { report: await readPerformanceReport(path.join(source, 'report.json')), source, run };
  };
  const regressions: unknown[] = [];
  const allReports: Report[] = [];
  const runnerIDs = new Set<string>();
  for (const shard of manifest.shards) {
    const runner = results.get(shard.id);
    if (!runner) continue;
    if (runnerIDs.has(runner.result.runnerID)) failures.push(`${shard.id}: Reused runner identity`);
    runnerIDs.add(runner.result.runnerID);
    failures.push(...runner.result.failures.map(failure => `${shard.id}: ${failure}`));
    if (
      !Number.isFinite(runner.result.elapsedMs) ||
      runner.result.elapsedMs < 0 ||
      runner.result.elapsedMs > ACTIVE_BUDGET_MS.runner
    )
      failures.push(`${shard.id}: Invalid/exceeded runner duration`);
    if (shard.layer === 'diagnostics') {
      try {
        if (runner.result.diagnostics?.control !== 0 || runner.result.diagnostics?.integrity !== 0)
          throw new Error('Control/integrity did not succeed');
        const integrity = await readJSON(path.join(runner.root, 'integrity/integrity.json'));
        if (integrity.outcome !== 'passed' || !integrity.isolated)
          throw new Error('Missing isolated integrity success');
        failures.push(
          ...executionFailures(
            integrity.execution,
            manifest,
            shard,
            'head',
            'control',
            runner.result.runnerID
          )
        );
        const control = await readPerformanceReport(path.join(runner.root, 'control/report.json'));
        const controlShard = {
          ...shard,
          layer: 'queries' as const,
          head: ['users.current/default'],
          base: [],
        };
        // This independent diagnostic is never included as duplicate catalog coverage.
        if (
          control.format !== REPORT_FORMAT ||
          control.protocol !== MEASUREMENT_PROTOCOL ||
          coverageFailures(
            shardMeasurementKeys(controlShard, 'head'),
            control.measurements.map(item => item.key)
          ).length ||
          control.measurements.some(item => item.failures.length) ||
          control.infrastructure.length
        )
          throw new Error('Invalid control-query diagnostics');
        failures.push(
          ...partialReportFailures(
            control,
            manifest,
            controlShard,
            'head',
            'control',
            runner.result.runnerID
          )
        );
        allReports.push(control);
        if (runner.result.runs.length) failures.push('diagnostics: Unexpected measurement phases');
      } catch (error) {
        failures.push(`diagnostics: ${String(error)}`);
      }
      continue;
    }
    const initial: Partial<Record<Revision, Report>> = {};
    for (const revision of ['head', 'base'] as const) {
      if (!aggregate[revision] || (shard.layer !== 'journeys' && !shard[revision].length)) continue;
      try {
        const { report, source, run } = await loadRun(runner, revision, 'initial');
        if (coverageFailures(shard[revision], run.selected).length)
          failures.push(`${shard.id}/${revision}: Changed run selection`);
        failures.push(
          ...partialReportFailures(
            report,
            manifest,
            shard,
            revision,
            'initial',
            runner.result.runnerID
          ).map(failure => `${shard.id}/${revision}: ${failure}`)
        );
        if (process.env.GITHUB_ACTIONS && (report as any).runtime?.platform !== 'linux')
          failures.push(`${shard.id}/${revision}: Native Linux measurement required`);
        initial[revision] = report;
        allReports.push(report);
        const full = aggregate[revision];
        if (!full) throw new Error('Missing revision aggregate');
        full.measurements.push(...report.measurements);
        full.mutations?.push(...(report.mutations ?? []));
        full.mutationDiagnostics?.push(...(report.mutationDiagnostics ?? []));
        full.externalDelivery = externalMutationDelivery(full.mutationDiagnostics ?? []);
        full.apiDiagnostics?.push(...(report.apiDiagnostics ?? []));
        full.serverWarnings?.push(...(report.serverWarnings ?? []));
        full.infrastructure.push(...report.infrastructure);
        if (shard.layer === 'journeys') {
          full.journeys = report.journeys;
          full.browserMutations = report.browserMutations;
        }
        await copyPlans(report, source, revision);
      } catch (error) {
        failures.push(`${shard.id}/${revision}: ${String(error)}`);
      }
    }
    const first = comparisons(initial.base, initial.head);
    const selected = confirmationSelection(shard, first);
    const confirmations: Partial<Record<Revision, Report>> = {};
    if (selected.length)
      for (const revision of ['base', 'head'] as const) {
        try {
          const { report, run } = await loadRun(runner, revision, 'confirmation');
          if (coverageFailures(selected, run.selected).length)
            failures.push(`${shard.id}/${revision}: Changed confirmation selection`);
          failures.push(
            ...partialReportFailures(
              report,
              manifest,
              shard,
              revision,
              'confirmation',
              runner.result.runnerID,
              selected
            ).map(failure => `${shard.id}/${revision}/confirmation: ${failure}`)
          );
          confirmations[revision] = report;
          allReports.push(report);
        } catch (error) {
          failures.push(`${shard.id}/${revision}/confirmation: ${String(error)}`);
        }
      }
    const second = comparisons(confirmations.base, confirmations.head);
    const expectedRuns = Object.keys(initial).length + (selected.length ? 2 : 0);
    if (runner.result.runs.length !== expectedRuns)
      failures.push(`${shard.id}: Unexpected or missing measurement phases`);
    failures.push(
      ...confirmationFailures(
        first,
        second,
        shardMeasurementKeys(shard, 'head', selected),
        confirmations.base,
        confirmations.head
      ).map(failure => `${shard.id}: ${failure}`)
    );
    regressions.push({ shard: shard.id, first, second });
  }
  failures.push(...freshGroupFailures(allReports));
  const sections: Record<string, unknown> = {};
  for (const revision of ['head', 'base'] as const) {
    const report = aggregate[revision];
    if (!report) continue;
    const revisionFailures = await reportFailures(report, revision === 'head');
    failures.push(...revisionFailures.map(failure => `${revision}: ${failure}`));
    await writeJSON(path.join(root, revision, 'report.json'), {
      ...report,
      budgets: BUDGETS,
      repetitions: REPETITIONS,
      manifestDigest: manifest.digest,
    });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(root, revision, 'results.csv'), resultsCSV(report.measurements));
    await writeFile(
      path.join(root, revision, 'mutations.csv'),
      mutationResultsCSV(report.mutations ?? [])
    );
    sections[revision] = {
      catalogExpected: report.expectedKeys.length,
      catalogMeasured: report.measurements.filter(item => item.profile !== 'security').length,
      mutationsExpected: report.expectedMutations?.length,
      mutationsMeasured: report.mutations?.length,
      mutationsFailures: report.mutations
        ?.filter(row => row.failures.length)
        .map(row => ({ key: row.key, failures: row.failures })),
      mutationBootstrap: report.mutationBootstrap,
      securityExpected: report.expectedSecurityCases?.length,
      securityMeasured: report.measurements.filter(item => item.profile === 'security').length,
      browserScenarios: report.journeys?.length,
      browserMutationActions: report.browserMutations?.length ?? 0,
      failures: revisionFailures,
    };
  }
  let timing: any;
  try {
    const prepare = await readJSON(
      path.join(path.dirname(path.resolve(requiredOption('--manifest'))), 'prepare.json')
    );
    if (prepare.manifestDigest !== manifest.digest)
      throw new Error('Mismatched preparation timing');
    const jobs = await ciJobs();
    const jobStartFile = option('--job-start-file');
    const mergeMs = jobStartFile
      ? os.uptime() * 1000 -
        Number(await (await import('node:fs/promises')).readFile(jobStartFile, 'utf8')) * 1000
      : performance.now() - started;
    const measured = jobs
      ? nativeTiming(
          jobs,
          mergeMs,
          manifest.shards.map(shard => shard.id)
        )
      : activeTiming(
          prepare.elapsedMs,
          Math.max(0, ...[...results.values()].map(runner => runner.result.elapsedMs)),
          mergeMs
        );
    timing = {
      ...measured,
      nativeCI: Boolean(jobs),
      runnerDetails: [...results.values()].map(({ result }) => ({
        shard: result.shardID,
        elapsedMs: result.elapsedMs,
        setupMs: result.setupMs,
        measurementMs: result.measurementMs,
        confirmationMs: result.confirmationMs,
        cleanupMs: result.cleanupMs,
      })),
    };
    if (measured.failed) failures.push('Active Zero CI time budget exceeded or invalid');
  } catch (error) {
    failures.push(`Timing: ${String(error)}`);
  }
  const outcome = {
    format: REPORT_FORMAT,
    protocol: MEASUREMENT_PROTOCOL,
    manifestDigest: manifest.digest,
    runID: manifest.runID,
    headSHA: manifest.headSHA,
    baseSHA: manifest.baseSHA,
    bootstrap: manifest.bootstrap,
    shardIDs: manifest.shards.map(shard => shard.id),
    coverage: {
      failures: [
        ...coverageFailures(
          manifest.shards.map(shard => shard.id),
          [...results.keys()]
        ),
        ...(['head', 'base'] as const).flatMap(revision => {
          const report = aggregate[revision];
          return report
            ? coverageFailures(
                [
                  ...report.expectedKeys,
                  ...(report.expectedSecurityCases ?? []).map(entry => entry.key),
                  ...(report.expectedMutations ?? []).map(entry => entry.key),
                ],
                [
                  ...report.measurements.map(entry => entry.key),
                  ...(report.mutations ?? []).map(entry => entry.key),
                ]
              ).map(failure => `${revision}: ${failure}`)
            : [];
        }),
        ...failures.filter(failure =>
          /fixture preflight|Changed run selection|Changed confirmation selection|Missing\/duplicate .*report|Missing or incomplete regression confirmation/.test(
            failure
          )
        ),
      ],
    },
    sections,
    regressions,
    timing,
    failures: [...new Set(failures)],
    passed: failures.length === 0,
  };
  await writeJSON(path.join(root, 'gate.json'), outcome);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Zero Query Performance\n\n${outcome.passed ? 'Passed' : 'Failed'}; active duration: ${timing ? (timing.activeMs / 60_000).toFixed(2) + ' minutes' : 'unavailable'}. GitHub queue time is reported separately.\n\n\`gate.json\` contains coverage, runner timings, confirmation results and all failures.\n`
    );
  console.log(
    JSON.stringify({
      passed: outcome.passed,
      timing,
      sections,
      failureCount: outcome.failures.length,
    })
  );
  if (!outcome.passed) process.exitCode = 1;
}
