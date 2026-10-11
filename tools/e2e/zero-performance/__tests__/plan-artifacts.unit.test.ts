import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readPerformanceReport, writeJoinPlanArtifact } from '../plan-artifacts';

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
});

async function fixture() {
  const output = await mkdtemp(path.join(tmpdir(), 'polity-plan-artifact-'));
  directories.push(output);
  const joins = [{ table: 'user', plan: { type: 'scan', candidates: ['id'] } }];
  const artifact = await writeJoinPlanArtifact(output, 'users.current/default/empty/owner', joins);
  const file = path.join(output, 'report.json');
  const report = {
    infrastructure: [],
    measurements: [{ key: 'users.current', plans: { joinsArtifact: artifact } }],
  };
  await writeFile(file, JSON.stringify(report));
  return { output, artifact, file, report };
}

describe('external join-plan diagnostics', () => {
  it('verifies complete traces without retaining them in the measurement report', async () => {
    const { file, artifact } = await fixture();
    const report = await readPerformanceReport(file);
    expect(report.infrastructure).toEqual([]);
    expect(report.measurements[0].plans).toEqual({ joinsArtifact: artifact });
  });
  it('rejects changed and missing traces', async () => {
    const { output, artifact, file } = await fixture();
    await writeFile(path.join(output, artifact.path), '[]');
    expect((await readPerformanceReport(file)).infrastructure[0]).toContain('integrity mismatch');
    await rm(path.join(output, artifact.path));
    expect((await readPerformanceReport(file)).infrastructure[0]).toContain('ENOENT');
  });
  it('rejects paths outside the report directory', async () => {
    const { file, report } = await fixture();
    report.measurements[0].plans.joinsArtifact.path = '../secret.json';
    await writeFile(file, JSON.stringify(report));
    expect((await readPerformanceReport(file)).infrastructure[0]).toContain('Invalid join-plan');
  });
  it('rejects a changed declared trace count', async () => {
    const { file, report } = await fixture();
    report.measurements[0].plans.joinsArtifact.count = 2;
    await writeFile(file, JSON.stringify(report));
    expect((await readPerformanceReport(file)).infrastructure[0]).toContain(
      'Invalid join-plan artifact contents'
    );
  });
});
