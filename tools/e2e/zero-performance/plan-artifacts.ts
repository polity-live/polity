import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, link, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { replicaTransportFailures, ivmSchedulingFailures, type Report } from './report';
import assert from 'node:assert/strict';
import { REPETITIONS } from './metrics';
import { readScanStatusArtifact, type ScanStatusArtifact } from './scan-status-artifacts';

export interface JoinPlanArtifact {
  path: string;
  sha256: string;
  bytes: number;
  count: number;
}

export function isJoinPlanArtifact(value: unknown): value is JoinPlanArtifact {
  if (!value || typeof value !== 'object') return false;
  const ref = value as JoinPlanArtifact;
  return (
    /^plans\/[a-f0-9]{64}\.json$/.test(ref.path) &&
    /^[a-f0-9]{64}$/.test(ref.sha256) &&
    Number.isSafeInteger(ref.bytes) &&
    ref.bytes >= 2 &&
    Number.isSafeInteger(ref.count) &&
    ref.count >= 0
  );
}

/** Join traces can be tens of MB each. Preserve them without retaining every trace in RAM. */
export async function writeJoinPlanArtifact(output: string, key: string, joins: unknown[]) {
  const data = Buffer.from(JSON.stringify(joins));
  const name = createHash('sha256').update(key).digest('hex');
  const ref: JoinPlanArtifact = {
    path: `plans/${name}.json`,
    sha256: createHash('sha256').update(data).digest('hex'),
    bytes: data.length,
    count: joins.length,
  };
  await mkdir(path.join(output, 'plans'), { recursive: true });
  await writeFile(path.join(output, ref.path), data);
  return ref;
}

/** Worker reports retain all hash-bound diagnostics when the collector publishes its report. */
export async function retainMeasurementArtifacts(source: string, output: string, plans: any) {
  const references: { path: string }[] = [];
  if (plans?.joinsArtifact) {
    if (!isJoinPlanArtifact(plans.joinsArtifact))
      throw new Error('Invalid worker join-plan reference');
    references.push(plans.joinsArtifact);
  }
  for (const ref of [
    ...(plans?.scanStatusArtifacts ?? []),
    ...(plans?.scanStatusExportArtifact ? [plans.scanStatusExportArtifact] : []),
  ]) {
    // Validate bytes and complete raw correspondence before retaining a worker artifact.
    await readScanStatusArtifact(source, ref);
    references.push(ref as ScanStatusArtifact);
  }
  await mkdir(path.join(output, 'plans'), { recursive: true });
  for (const ref of references) {
    try {
      await link(path.join(source, ref.path), path.join(output, ref.path));
    } catch (error) {
      if (!['EXDEV', 'EPERM', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? ''))
        throw error;
      await copyFile(
        path.join(source, ref.path),
        path.join(output, ref.path),
        constants.COPYFILE_EXCL
      );
    }
  }
}

/** Verify one exported trace at a time; missing or altered diagnostics cannot pass the gate. */
export async function readPerformanceReport(file: string): Promise<Report> {
  const report: Report = JSON.parse(await readFile(file, 'utf8'));
  report.infrastructure.push(...replicaTransportFailures(report));
  report.infrastructure.push(...ivmSchedulingFailures(report));
  const runtime = (
    report as Report & {
      runtime?: {
        zero: string;
        node: string;
        sqliteDriver: string;
        scanStatusSourceSHA256: string;
        scanStatusRuntimeID: string;
      };
    }
  ).runtime;
  const executions = new Set<string>();
  function verifyRuntime(artifact: any) {
    if (!runtime || !/^[a-f0-9]{64}$/.test(runtime.scanStatusSourceSHA256))
      throw new Error('Missing SQLite runtime provenance');
    for (const record of artifact.records) {
      if (
        record.runtimeID !== runtime.scanStatusRuntimeID ||
        record.sdkVersion !== runtime.zero ||
        record.nodeVersion !== runtime.node ||
        record.driverVersion !== runtime.sqliteDriver ||
        record.tableSourceSHA256 !== runtime.scanStatusSourceSHA256
      )
        throw new Error('SQLite scan-status runtime provenance mismatch');
      const identity = `${record.runtimeID}/${record.pid}/${record.statementID}/${record.epoch}`;
      if (executions.has(identity))
        throw new Error('Reused SQLite scan-status execution across analysis phases');
      executions.add(identity);
    }
  }
  for (const measurement of report.measurements) {
    const plans = measurement.plans as {
      joinsArtifact?: unknown;
      joins?: unknown;
      sqlite?: unknown;
      scansByQuery?: unknown;
      scanStatusArtifacts?: unknown[];
      scanStatusExportArtifact?: unknown;
    } | null;
    if ('analyzeMs' in measurement || plans?.sqlite || plans?.scansByQuery) {
      try {
        if (!plans?.sqlite || !plans.scansByQuery)
          throw new Error('Missing SQLite analyzer plans/counts');
        if (
          !Array.isArray(plans.scanStatusArtifacts) ||
          plans.scanStatusArtifacts.length !== REPETITIONS.warmup + REPETITIONS.analyze
        )
          throw new Error('Missing SQLite scan-status analysis artifacts');
        let finalAnalysis;
        for (const ref of plans.scanStatusArtifacts) {
          finalAnalysis = await readScanStatusArtifact(path.dirname(file), ref);
          verifyRuntime(finalAnalysis);
        }
        assert.deepEqual(
          finalAnalysis.counts,
          plans.scansByQuery,
          'Reported analyzer scans differ from SQLite provenance'
        );
        const total = Object.values(finalAnalysis.counts as Record<string, Record<string, number>>)
          .flatMap(counts => Object.values(counts))
          .reduce((sum, count) => sum + count, 0);
        if (total !== measurement.scannedRows)
          throw new Error('Reported scanned rows differ from SQLite provenance');
        const exported = await readScanStatusArtifact(
          path.dirname(file),
          plans.scanStatusExportArtifact
        );
        verifyRuntime(exported);
        assert.deepEqual(
          exported.sqlite,
          plans.sqlite,
          'Exported SQLite plans differ from provenance'
        );
      } catch (error) {
        report.infrastructure.push(`${measurement.key}: ${String(error)}`);
      }
    }
    if (!plans?.joinsArtifact) continue;
    try {
      const ref = plans.joinsArtifact;
      if (!isJoinPlanArtifact(ref)) throw new Error('Invalid join-plan artifact reference');
      const data = await readFile(path.join(path.dirname(file), ref.path));
      if (
        data.length !== ref.bytes ||
        createHash('sha256').update(data).digest('hex') !== ref.sha256
      )
        throw new Error('Join-plan artifact integrity mismatch');
      const joins: unknown = JSON.parse(data.toString('utf8'));
      if (!Array.isArray(joins) || joins.length !== ref.count)
        throw new Error('Invalid join-plan artifact contents');
    } catch (error) {
      report.infrastructure.push(`${measurement.key}: ${String(error)}`);
    }
  }
  return report;
}
