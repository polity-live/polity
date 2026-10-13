import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUDGETS, checkBudgets, median, type Measurement } from './metrics';
import { attributeNavigationProfile, attributeBackTrace } from './navigation-attribution';
import { createHash } from 'node:crypto';
import { localTimelineSegments } from './query-timeline';

/** Offline diagnostic only. Usage:
 * node --import tsx tools/e2e/zero-performance/analyze-artifacts.ts <artifacts> <output>
 * Writes diagnostics.txt and diagnostics.json outside the input directory.
 * No benchmark execution, artifact edits, retries or gate decisions.
 */

type Category =
  | 'absolute-budget'
  | 'confirmed-regression'
  | 'unconfirmed-regression'
  | 'invalid-measurement'
  | 'infrastructure';
interface Finding {
  category: Category;
  message: string;
}

export function summarize(values: unknown[], budget?: number) {
  const valid =
    values.length > 0 &&
    values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  return {
    values,
    valid,
    maximum: valid ? Math.max(...(values as number[])) : null,
    median: valid ? median(values as number[]) : null,
    budget: budget ?? null,
    exceedances:
      valid && budget !== undefined
        ? values.filter(value => (value as number) > budget).length
        : null,
  };
}

export function classify(message: string): Category {
  if (
    /authentication|connection.*timed out|process exited|deadline|startup|owned session/i.test(
      message
    )
  )
    return 'infrastructure';
  if (
    /^(?:Query [^:]+: )?(?:Total|Client|Server materialization|Cached display|Authoritative content|Visible content|Preload|Mutation .+) exceeds \d+ ms$/.test(
      message
    )
  )
    return 'absolute-budget';
  return 'invalid-measurement';
}

export function analyzeQuery(measurement: Measurement) {
  let failures: string[];
  try {
    failures = checkBudgets(measurement);
  } catch (error) {
    failures = [`Malformed measurement: ${String(error)}`];
  }
  failures = [
    ...new Set([...failures, ...(Array.isArray(measurement.failures) ? measurement.failures : [])]),
  ];
  const samples = Array.isArray(measurement.samples) ? measurement.samples : [];
  return {
    key: measurement.key,
    workload: {
      revision: measurement.revision,
      reason: measurement.reason,
      args: measurement.args,
      expectedIDs: measurement.expectedIDs,
    },
    metrics: {
      total: summarize(
        samples.map(sample => sample.totalMs),
        BUDGETS.totalMs
      ),
      client: summarize(
        samples.map(sample => sample.clientMs),
        BUDGETS.clientMs
      ),
      server: summarize(
        samples.map(sample => sample.serverMs),
        BUDGETS.serverMs
      ),
      connection: summarize(samples.map(sample => sample.connectionMs)),
      apiAuth: summarize(samples.map(sample => sample.api?.authMs)),
      apiTransform: summarize(samples.map(sample => sample.api?.transformMs)),
      apiRequest: summarize(samples.map(sample => sample.api?.requestMs)),
    },
    findings: failures.map(message => ({ category: classify(message), message })),
    samples,
    timeline: [] as any[],
    timeComponents: {} as any,
  };
}

// runnerID is evidence about the environment, not part of the equality key:
// a repeat on another runner must remain visible as a separate observation.
export function repeatKey(execution: any, key: string, workload: unknown) {
  if (!execution?.sourceSHA || !execution?.harnessDigest || !execution?.shardID) return null;
  const stable = (value: any): any =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map(key => [key, stable(value[key])])
          )
        : value;
  return JSON.stringify(
    stable({
      sourceSHA: execution.sourceSHA,
      harnessDigest: execution.harnessDigest,
      shardID: execution.shardID,
      key,
      workload,
    })
  );
}

export function confirmationStatus(first: any[], second: any[], executed: boolean, valid: boolean) {
  if (!first.length)
    return {
      status: 'not-requested',
      reason:
        'No relative median/work regression candidate; absolute budget failures alone do not trigger confirmation.',
    };
  if (!executed)
    return {
      status: 'missing',
      reason: 'Relative regression candidate exists but both confirmation reports are not present.',
    };
  if (!valid)
    return {
      status: 'invalid',
      reason: 'Confirmation identity or telemetry is invalid; disappearance cannot be inferred.',
    };
  return {
    status: 'executed',
    reason: 'Relative regression candidates were measured again.',
    findings: first.map(change => ({
      category: second.some(item => item.key === change.key && item.metric === change.metric)
        ? 'confirmed-regression'
        : 'unconfirmed-regression',
      message: `${change.key}/${change.metric}`,
      before: change.before,
      after: change.after,
    })),
  };
}

async function files(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await files(file)));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}
async function json(file: string) {
  return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
}

export async function analyzeArtifacts(root: string) {
  const inventory = await files(root);
  const reports: any[] = [],
    issues: any[] = [];
  const timelines: any[] = [];
  const absoluteConfirmations: any[] = [];
  const navigationAttributions: any[] = [];
  for (const file of inventory) {
    try {
      if (path.basename(file) === 'query-timeline.json') {
        const value = await json(file);
        if (value.format !== 'zero-query-timeline/v1' || !Array.isArray(value.samples))
          throw new Error('Unsupported query timeline');
        timelines.push(
          ...value.samples.map((sample: any) => ({
            ...sample,
            evidence: path.relative(root, file),
          }))
        );
      }
      if (path.basename(file) === 'absolute-confirmation.json') {
        const value = await json(file);
        if (value.format !== 'zero-absolute-confirmation/v1' || !Array.isArray(value.findings))
          throw new Error('Unsupported absolute confirmation');
        absoluteConfirmations.push({ ...value, evidence: path.relative(root, file) });
      }
      if (
        path.basename(file) === 'navigation.cpuprofile' &&
        path.basename(path.dirname(file)) === 'navigation-history-diagnostic'
      ) {
        const directory = path.dirname(file),
          maps = new Map<string, any>();
        const profile = await json(file);
        const manifestFile = path.join(directory, 'manifest.json');
        if (inventory.includes(manifestFile)) {
          const manifest = await json(manifestFile);
          for (const map of manifest.sourceMaps ?? []) {
            const mapFile = path.join(directory, map.file);
            if (path.basename(map.file) !== map.file || !inventory.includes(mapFile)) continue;
            if (
              createHash('sha256')
                .update(await readFile(mapFile))
                .digest('hex') !== map.sha256
            )
              throw new Error('Retained source map digest mismatch');
            const asset = (manifest.assets ?? []).find((item: any) => item.path === map.asset);
            if (
              !asset ||
              path.basename(asset.file) !== asset.file ||
              (map.assetSha256 && map.assetSha256 !== asset.sha256) ||
              createHash('sha256')
                .update(await readFile(path.join(directory, asset.file)))
                .digest('hex') !== asset.sha256
            )
              throw new Error('Source map bundle digest mismatch');
            // Resolve URLs from CPU frames, using the retained bundle's pathname.
            for (const node of profile.nodes ?? []) {
              try {
                if (new URL(node.callFrame.url).pathname === map.asset)
                  maps.set(node.callFrame.url, await json(mapFile));
              } catch {
                /* Non-asset frame. */
              }
            }
          }
        }
        navigationAttributions.push({
          ...attributeNavigationProfile(profile, maps),
          backNavigations: inventory.includes(path.join(directory, 'navigation-timeline.json'))
            ? attributeBackTrace(
                (await json(path.join(directory, 'navigation-timeline.json'))).events ?? []
              )
            : [],
          evidence: path.relative(root, file),
        });
      }
    } catch (error) {
      issues.push({
        evidence: path.relative(root, file),
        category: 'invalid-measurement',
        message: String(error),
      });
    }
  }
  // Prefer aggregate reports. Worker copies are evidence, not extra executions.
  for (const file of inventory.filter(file => path.basename(file) === 'report.json')) {
    const parts = path.relative(root, file).split(path.sep);
    const workerIndex = parts.indexOf('workers');
    if (
      workerIndex >= 0 &&
      inventory.includes(path.join(root, ...parts.slice(0, workerIndex), 'report.json'))
    )
      continue;
    try {
      const report = await json(file);
      if (report.protocol !== 'zero-performance/v12' || report.format !== 12)
        throw new Error('Unsupported report protocol/format');
      if (
        !Array.isArray(report.measurements) ||
        (report.layer === 'journeys' && !Array.isArray(report.journeys)) ||
        !Array.isArray(report.infrastructure)
      )
        throw new Error('Missing report collections');
      const queries = report.measurements.map(analyzeQuery);
      for (const query of queries) {
        query.timeline = timelines.filter(
          item =>
            item.key === query.key &&
            query.samples.some(
              (sample: any) => sample.clientCorrelationID === item.clientCorrelationID
            ) &&
            ['sourceSHA', 'harnessDigest', 'runnerID', 'phase', 'shardID', 'manifestDigest'].every(
              key =>
                typeof item.execution?.[key] === 'string' &&
                item.execution[key] === report.execution?.[key]
            )
        );
        query.timeComponents = {
          localSegments: query.timeline.map((item: any) => localTimelineSegments(item)),
          elapsed: summarize(query.timeline.map((item: any) => item.elapsedMs)),
          sdkHydration: summarize(query.timeline.map((item: any) => item.sdkHydrateTotalMs)),
          source: query.timeline.length
            ? query.timeline.map((item: any) => item.totalSource)
            : 'unknown: historical artifact has no separated timing components',
          budgetExceededBy: query.timeline.map((item: any) => item.budgetExceededBy ?? 'unknown'),
          gap: 'Transport and scheduling are not independently observable here; cross-process wall clocks are not subtracted.',
        };
      }
      let frames: any[] = [];
      const directFrames = path.join(path.dirname(file), 'navigation-original-frames.ndjson');
      const framesFile = inventory.includes(directFrames)
        ? directFrames
        : path.join(path.dirname(file), 'workers', 'journeys', 'navigation-original-frames.ndjson');
      if (inventory.includes(framesFile)) {
        frames = (await readFile(framesFile, 'utf8'))
          .split(/\r?\n/)
          .filter(Boolean)
          .map(line => JSON.parse(line))
          .filter(row => row.scope === 'original-measured-navigation');
      }
      const journeys = (report.journeys ?? []).map((journey: any) => ({
        route: journey.route,
        visit: journey.visit,
        visibleMs: journey.visibleMs,
        authoritativeMs: journey.authoritativeMs,
        cachedDisplayMs: journey.cachedDisplayMs,
        findings: (journey.failures ?? []).map((message: string) => ({
          category: classify(message),
          message,
        })),
        originalFrames: frames.filter(
          row => row.route === journey.route && row.visit === journey.visit
        ),
        longTasks:
          journey.longTasks ??
          journey.processing?.longTasks ??
          journey.diagnostics?.longTasks ??
          null,
        navigationEvidence:
          journey.processing ?? journey.navigationFrames ?? journey.diagnostics ?? null,
        queries: journey.queries,
        preloadEvents: journey.preloadEvents ?? null,
        viewEvents: journey.viewEvents ?? null,
        evidence: {
          report: path.relative(root, file),
          originalFrames: inventory.includes(framesFile) ? path.relative(root, framesFile) : null,
        },
        attribution:
          'Timing and overlapping browser activity are evidence; a causal attribution is not established automatically. Post-acceptance profiles do not replace these observations.',
      }));
      reports.push({
        evidence: path.relative(root, file),
        execution: report.execution,
        runtime: report.runtime,
        budgets: report.budgets,
        queries,
        journeys,
        findings: report.infrastructure.map((message: string) => ({
          category: classify(message),
          message,
        })),
        mutationKeys: (report.mutations ?? []).map((row: any) => row.key),
        mutationFindings: (report.mutations ?? []).flatMap((row: any) =>
          (row.failures ?? []).map((message: string) => ({
            key: row.key,
            category: classify(message),
            message,
          }))
        ),
      });
    } catch (error) {
      issues.push({
        evidence: path.relative(root, file),
        category: 'invalid-measurement',
        message: String(error),
      });
    }
  }
  const comparisons: any[] = [];
  for (const file of inventory.filter(file => path.basename(file) === 'comparison.json')) {
    try {
      const data = await json(file),
        directory = path.dirname(file);
      const related = reports.filter(report =>
        path.resolve(root, report.evidence).startsWith(directory + path.sep)
      );
      const initial = related.filter(report => report.execution?.phase === 'initial');
      const confirmation = related.filter(
        report =>
          report.execution?.phase === 'confirmation' &&
          !report.evidence.split(path.sep).includes('absolute-confirmation')
      );
      const executed = ['base', 'head'].every(revision =>
        confirmation.some(report => report.execution?.revision === revision)
      );
      const valid =
        executed &&
        confirmation.every(report => {
          const original = initial.find(
            item => item.execution?.revision === report.execution.revision
          );
          return (
            original &&
            ['sourceSHA', 'harnessDigest', 'runnerID', 'manifestDigest', 'shardID'].every(
              key =>
                typeof original.execution[key] === 'string' &&
                original.execution[key].length > 0 &&
                original.execution[key] === report.execution[key]
            ) &&
            !report.findings.length &&
            report.queries.every((query: any) =>
              query.findings.every((finding: Finding) => finding.category === 'absolute-budget')
            )
          );
        }) &&
        !confirmation.some(report =>
          report.mutationFindings.some((finding: Finding) => finding.category !== 'absolute-budget')
        ) &&
        (data.first ?? []).every((change: any) =>
          ['base', 'head'].every(revision =>
            confirmation.some(
              report =>
                report.execution.revision === revision &&
                (report.queries.some((query: any) => query.key === change.key) ||
                  report.mutationKeys.includes(change.key))
            )
          )
        );
      if (!Array.isArray(data.first) || !Array.isArray(data.second))
        throw new Error('Missing comparison arrays');
      const status = confirmationStatus(data.first, data.second, executed, valid);
      comparisons.push({
        evidence: path.relative(root, file),
        first: data.first,
        second: data.second,
        confirmation: status,
        note: 'Diagnostic classification only; existing gate validation remains authoritative.',
      });
    } catch (error) {
      issues.push({
        evidence: path.relative(root, file),
        category: 'invalid-measurement',
        message: String(error),
      });
    }
  }
  const groups = new Map<string, any[]>();
  for (const report of reports) {
    for (const query of report.queries) {
      const key = repeatKey(report.execution, query.key, query.workload);
      if (!key) continue;
      const entries = groups.get(key) ?? [];
      entries.push({
        evidence: report.evidence,
        execution: report.execution,
        metrics: query.metrics,
        findings: query.findings,
      });
      groups.set(key, entries);
    }
    for (const journey of report.journeys) {
      // Include the complete itinerary to avoid comparing different workloads.
      const key = repeatKey(report.execution, `${journey.route}/${journey.visit}`, {
        itinerary: report.journeys.map((item: any) => [item.route, item.visit]),
      });
      if (!key) continue;
      const entries = groups.get(key) ?? [];
      entries.push({
        evidence: report.evidence,
        execution: report.execution,
        cachedDisplayMs: journey.cachedDisplayMs,
        findings: journey.findings,
      });
      groups.set(key, entries);
    }
  }
  return {
    format: 'zero-performance-diagnostics/v1',
    input: path.resolve(root),
    gateChanged: false,
    reports,
    comparisons,
    absoluteConfirmations,
    navigationAttributions,
    issues,
    repetitions: [...groups.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([identity, observations]) => ({ identity: JSON.parse(identity), observations })),
  };
}

export function readableReport(analysis: Awaited<ReturnType<typeof analyzeArtifacts>>) {
  const lines = [
    'Zero performance artifact diagnostics',
    'Diagnostic only: original gates, budgets and samples are unchanged.',
    `Reports: ${analysis.reports.length}; unreadable/unsupported artifacts: ${analysis.issues.length}`,
    '',
  ];
  for (const report of analysis.reports) {
    lines.push(report.evidence, JSON.stringify(report.execution));
    for (const query of report.queries.filter((query: any) => query.findings.length)) {
      lines.push(`  ${query.key}`);
      lines.push(`    timeline: ${JSON.stringify(query.timeComponents)}`);
      for (const [metric, summary] of Object.entries(query.metrics) as [string, any][])
        lines.push(
          `    ${metric}: samples=${JSON.stringify(summary.values)} max=${summary.maximum} median=${summary.median} exceeding=${summary.exceedances} budget=${summary.budget}`
        );
      lines.push(
        ...query.findings.map((finding: Finding) => `    ${finding.category}: ${finding.message}`)
      );
    }
    for (const journey of report.journeys.filter((journey: any) => journey.findings.length))
      lines.push(
        `  ${journey.route}/${journey.visit}: cached=${journey.cachedDisplayMs}ms; original frame groups=${journey.originalFrames.length}`,
        ...journey.findings.map((finding: Finding) => `    ${finding.category}: ${finding.message}`)
      );
    lines.push(
      ...report.findings.map((finding: Finding) => `  ${finding.category}: ${finding.message}`),
      ...report.mutationFindings.map(
        (finding: any) => `  ${finding.key}: ${finding.category}: ${finding.message}`
      ),
      ''
    );
  }
  for (const item of analysis.comparisons)
    lines.push(
      `${item.evidence}: confirmation=${item.confirmation.status}; ${item.confirmation.reason}`,
      ...(item.confirmation.findings ?? []).map(
        (finding: Finding) => `  ${finding.category}: ${finding.message}`
      )
    );
  lines.push(
    `Comparable repetition groups: ${analysis.repetitions.length}`,
    ...analysis.issues.map(issue => `${issue.evidence}: ${issue.message}`)
  );
  for (const repetition of analysis.repetitions) {
    if (!repetition.observations.some(observation => observation.findings.length)) continue;
    lines.push(
      `Repeat: ${repetition.identity.key}; source=${repetition.identity.sourceSHA}; harness=${repetition.identity.harnessDigest}`
    );
    for (const observation of repetition.observations)
      lines.push(
        `  ${observation.evidence}; runner=${observation.execution.runnerID}; phase=${observation.execution.phase}; total=${JSON.stringify(observation.metrics?.total ?? observation.cachedDisplayMs)}; findings=${JSON.stringify(observation.findings)}`
      );
  }
  for (const item of analysis.absoluteConfirmations)
    lines.push(
      `Absolute confirmation: ${item.evidence}`,
      ...item.findings.map(
        (finding: any) => `  ${finding.key}: ${finding.status}; ${finding.reason}`
      )
    );
  for (const item of analysis.navigationAttributions) {
    lines.push(`Replay CPU attribution: ${item.evidence}`, `  ${item.attribution}`);
    for (const frame of item.functions.slice(0, 15))
      lines.push(
        `  ${frame.functionName}: ${frame.sampledSelfMs.toFixed(2)}ms sampled self; ${frame.url}:${frame.line}:${frame.column}; sourcemap=${frame.sourceMapStatus}; source=${JSON.stringify(frame.source)}`
      );
    for (const cut of item.backNavigations)
      lines.push(
        `  Replay back index=${cut.index}: ${cut.status}; clock=${cut.clock}; original causality=unknown`,
        ...cut.events
          .filter((event: any) => event.stack.length)
          .slice(0, 15)
          .map(
            (event: any) =>
              `    ${event.name}: overlap=${event.overlapMs.toFixed(2)}ms; stack=${JSON.stringify(event.stack)}`
          )
      );
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length)
    throw new Error(
      'Usage: node --import tsx tools/e2e/zero-performance/analyze-artifacts.ts <artifact-directory> <output-directory>'
    );
  if (
    path.resolve(input) === path.resolve(output) ||
    path.resolve(output).startsWith(path.resolve(input) + path.sep)
  )
    throw new Error('Output must be outside the input artifact directory');
  const analysis = await analyzeArtifacts(path.resolve(input));
  if (!analysis.reports.length) throw new Error('No supported performance reports found');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'diagnostics.json'), JSON.stringify(analysis, null, 2) + '\n');
  await writeFile(path.join(output, 'diagnostics.txt'), readableReport(analysis));
  console.log(`Analyzed ${analysis.reports.length} reports; diagnostics: ${path.resolve(output)}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => {
    console.error(String(error));
    process.exitCode = 1;
  });
