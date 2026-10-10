import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

globalThis.TESTING = false;
Date.now = () => 1_800_000_000_000;
const current = await import('../tools/e2e/zero-performance/catalog.ts');
const previous = await import('../output/zero-performance/complete-current-v9-1/project/tools/e2e/zero-performance/catalog.ts');
const { zql } = await import('../src/zero/schema.ts');
const { applyEventQueryAccess, applyAgendaItemQueryAccess } = await import('../src/zero/rbac/query-access.ts');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).filter(key => key !== 'flip').sort().map(key => [key, canonical(value[key])])) : value;
const copy = value => JSON.parse(JSON.stringify(value));
const beforeCases = previous.loadCases();
const afterCases = current.loadCases();
assert.deepEqual(afterCases.map(c => [c.name, c.variant, c.args]), beforeCases.map(c => [c.name, c.variant, c.args]));
let unchanged = 0;
let factored = 0;
for (let i = 0; i < afterCases.length; i++) for (const ctx of [current.OWNER, current.OUTSIDER, { userID: 'anon', email: '' }]) {
  const entry = afterCases[i];
  const before = copy(previous.buildQuery(beforeCases[i], ctx).ast);
  const after = copy(current.buildQuery(entry, ctx).ast);
  if (entry.name === 'events.byIdFull') {
    assert.deepEqual(canonical(after.where), canonical(applyEventQueryAccess(zql.event.where('id', entry.args.id), ctx.userID).ast.where));
    const relation = before.related.find(r => r.subquery.alias === 'agenda_items');
    assert.ok(relation);
    assert.deepEqual(relation.correlation, { parentField: ['id'], childField: ['event_id'] });
    assert.deepEqual(canonical(relation.subquery.where), canonical(applyAgendaItemQueryAccess(zql.agenda_item, ctx.userID).ast.where));
    delete relation.subquery.where;
    factored++;
  } else unchanged++;
  assert.deepEqual(canonical(after), canonical(before), `${entry.name}/${entry.variant}/${ctx.userID}`);
}
const result = { checks: unchanged + factored, unchangedPredicates: unchanged, authorizedParentFactorizations: factored };
await mkdir('output/zero-performance/current-planning-proof', { recursive: true });
await writeFile('output/zero-performance/current-planning-proof/result.json', JSON.stringify(result));
console.log(JSON.stringify(result));
