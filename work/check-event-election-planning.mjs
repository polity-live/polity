import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
globalThis.TESTING = false;
const { loadCases, buildQuery, OWNER, OUTSIDER } = await import('../tools/e2e/zero-performance/catalog.ts');
const names = ['events.electionWithVotes', 'events.delegateAssemblyComposition'];
const entries = loadCases().filter(entry => names.includes(entry.name));
const snapshots = entries.flatMap(entry => [OWNER, OUTSIDER, { userID: 'anon', email: '' }].map(ctx => ({
  name: entry.name, variant: entry.variant, ctx, ast: JSON.parse(JSON.stringify(buildQuery(entry, ctx).ast)),
})));
const destination = 'output/zero-performance/event-election-plan-check';
await mkdir(destination, { recursive: true });
if (process.argv.includes('--before')) await writeFile(`${destination}/before.json`, JSON.stringify(snapshots));
else {
  const before = JSON.parse(await readFile(`${destination}/before.json`, 'utf8'));
  const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'flip').map(([key, child]) => [key, strip(child)])) : value;
  assert.deepEqual(strip(snapshots), strip(before));
  const result = { checks: snapshots.length, changedPlanningOnly: snapshots.filter((value, i) => JSON.stringify(value) !== JSON.stringify(before[i])).length };
  await writeFile(`${destination}/result.json`, JSON.stringify(result));
  console.log(JSON.stringify(result));
}
