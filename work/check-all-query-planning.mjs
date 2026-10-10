import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
globalThis.TESTING = false;
Date.now = () => 1_800_000_000_000;
const { loadCases, buildQuery, OWNER, OUTSIDER } =
  await import('../tools/e2e/zero-performance/catalog.ts');
const strip = value =>
  Array.isArray(value)
    ? value.map(strip)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== 'flip')
            .map(([key, child]) => [key, strip(child)])
        )
      : value;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshots = [];
for (const entry of loadCases())
  for (const ctx of [OWNER, OUTSIDER, { userID: 'anon', email: '' }]) {
    const ast = JSON.parse(JSON.stringify(buildQuery(entry, ctx).ast));
    snapshots.push({
      key: `${entry.name}/${entry.variant}/${ctx.userID}`,
      predicates: digest(strip(ast)),
      planning: digest(ast),
    });
  }
const destination = 'output/zero-performance/all-query-planning-check';
await mkdir(destination, { recursive: true });
if (process.argv.includes('--before'))
  await writeFile(`${destination}/before.json`, JSON.stringify(snapshots));
else {
  const before = JSON.parse(await readFile(`${destination}/before.json`, 'utf8'));
  assert.deepEqual(
    snapshots.map(({ planning: _planning, ...rest }) => rest),
    before.map(({ planning: _planning, ...rest }) => rest)
  );
  const changed = snapshots
    .filter((value, i) => value.planning !== before[i].planning)
    .map(value => value.key);
  const result = { checks: snapshots.length, changedPlanningOnly: changed.length, changed };
  await writeFile(`${destination}/result.json`, JSON.stringify(result));
  console.log(
    JSON.stringify({ checks: result.checks, changedPlanningOnly: result.changedPlanningOnly })
  );
}
