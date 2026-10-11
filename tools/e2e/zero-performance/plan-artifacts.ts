import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Report } from './report';

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

/** Verify one exported trace at a time; missing or altered diagnostics cannot pass the gate. */
export async function readPerformanceReport(file: string): Promise<Report> {
  const report: Report = JSON.parse(await readFile(file, 'utf8'));
  for (const measurement of report.measurements) {
    const plans = measurement.plans as { joinsArtifact?: unknown; joins?: unknown } | null;
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
