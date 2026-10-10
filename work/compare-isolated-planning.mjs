import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

globalThis.TESTING = false;
Date.now = () => 1_800_000_000_000;
const current = await import('file:///C:/instant-to-zero/polity-zero-performance-ci/tools/e2e/zero-performance/catalog.ts');
const previous = await import('../output/zero-performance/complete-current-v9-1/project/tools/e2e/zero-performance/catalog.ts');
const { zql } = await import('file:///C:/instant-to-zero/polity-zero-performance-ci/src/zero/schema.ts');
const { applyEventQueryAccess, applyAgendaItemQueryAccess } = await import('file:///C:/instant-to-zero/polity-zero-performance-ci/src/zero/rbac/query-access.ts');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).filter(key => key !== 'flip').sort().map(key => [key, canonical(value[key])])) : value;
const copy = value => JSON.parse(JSON.stringify(value));
const beforeCases = previous.loadCases();
const afterCases = current.loadCases();
const commonCases = afterCases.filter(c => c.name !== 'events.forAgenda');
assert.deepEqual(commonCases.map(c => [c.name, c.variant, c.args]), beforeCases.map(c => [c.name, c.variant, c.args]));
let unchanged = 0;
let factored = 0;
let indexedEndpoints = 0;
let equivalentKindGates = 0;
const endpointFields = {
  'network.hierarchyPathsByGroup': ['group_hierarchy_path', 'ancestor_group_id', 'descendant_group_id'],
  'network.effectiveRightsByGroup': ['group_effective_right', 'holder_group_id', 'scope_group_id'],
  'network.membershipExclusivityLocksByGroup': ['group_membership_exclusivity_lock', 'hierarchy_group_id', 'source_group_id'],
  'network.siblingSourceLocksByGroup': ['group_sibling_source_lock', 'sibling_group_id', 'source_group_id'],
  'network.groupConnectionRequestsByGroup': ['group_connection_request', 'group_a_id', 'group_b_id'],
};
const migration = await readFile('supabase/migrations/20260922043912_initial_reset.sql', 'utf8');
for (const [table, ...fields] of Object.values(endpointFields)) for (const field of fields) {
  assert.ok(migration.includes(`FOREIGN KEY (${field}) REFERENCES public."group"(id)`));
  assert.ok(migration.includes(`alter table "public"."${table}" validate constraint "${table}_${field}_fkey";`));
}
for (let i = 0; i < commonCases.length; i++) for (const ctx of [current.OWNER, current.OUTSIDER, { userID: 'anon', email: '' }]) {
  const entry = commonCases[i];
  const before = copy(previous.buildQuery(beforeCases[i], ctx).ast);
  let after = copy(current.buildQuery(entry, ctx).ast);
  if (entry.name === 'events.byIdFull') {
    assert.deepEqual(canonical(after.where), canonical(applyEventQueryAccess(zql.event.where('id', entry.args.id), ctx.userID).ast.where));
    const relation = before.related.find(r => r.subquery.alias === 'agenda_items');
    assert.ok(relation);
    assert.deepEqual(relation.correlation, { parentField: ['id'], childField: ['event_id'] });
    assert.deepEqual(canonical(relation.subquery.where), canonical(applyAgendaItemQueryAccess(zql.agenda_item, ctx.userID).ast.where));
    delete relation.subquery.where;
    factored++;
  } else if (endpointFields[entry.name]) {
    const [table, ...fields] = endpointFields[entry.name];
    assert.equal(after.table, table);
    let joins = 0;
    const normalize = value => {
      if (value?.type === 'correlatedSubquery' && value.flip === true) {
        assert.equal(value.op, 'EXISTS');
        assert.equal(value.related.subquery.table, 'group');
        assert.deepEqual(value.related.correlation.childField, ['id']);
        assert.equal(value.related.correlation.parentField.length, 1);
        const field = value.related.correlation.parentField[0];
        assert.ok(fields.includes(field));
        assert.deepEqual(value.related.subquery.where, {
          type: 'simple', op: '=', left: {type: 'column', name: 'id'},
          right: {type: 'literal', value: entry.args.groupId},
        });
        joins++;
        return {type: 'simple', op: '=', left: {type: 'column', name: field},
          right: {type: 'literal', value: entry.args.groupId}};
      }
      return Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)])) : value;
    };
    after.where = normalize(after.where);
    assert.equal(joins, 2);
    indexedEndpoints++;
  } else if (entry.name === 'appearanceThemes.catalog') {
    assert.equal(before.where.type, 'or');
    const kinds = before.where.conditions.map(branch => {
      const conditions = branch.type === 'and' ? branch.conditions : [branch];
      const kind = conditions.find(c => c.type === 'simple' && c.op === '=' && c.left.name === 'kind');
      assert.ok(kind);
      return kind.right.value;
    });
    assert.deepEqual(kinds.slice().sort(), ['builtin', 'group', 'personal']);
    assert.equal(after.where.type, 'and');
    const guard = after.where.conditions.filter(c => c.type === 'or' && c.conditions.length === 3 && c.conditions.every(v => v.type === 'simple' && v.op === '=' && v.left.name === 'kind'));
    assert.deepEqual(guard, [{type: 'or', conditions: ['builtin', 'personal', 'group'].map(value => ({type: 'simple', op: '=', left: {type: 'column', name: 'kind'}, right: {type: 'literal', value}}))}]);
    const gates = after.where.conditions.filter(c => c !== guard[0]);
    assert.equal(gates.length, 2);
    for (const [i, kind] of ['personal', 'group'].entries()) {
      assert.equal(gates[i].type, 'or');
      assert.equal(gates[i].conditions.length, 2);
      assert.deepEqual(gates[i].conditions[0], {type: 'simple', op: '!=', left: {type: 'column', name: 'kind'}, right: {type: 'literal', value: kind}});
      const oldBranch = before.where.conditions.find(branch => branch.type === 'and' && branch.conditions.some(c => c.type === 'simple' && c.left.name === 'kind' && c.right.value === kind));
      assert.ok(oldBranch);
      const oldConditions = oldBranch.conditions.filter(c => !(c.type === 'simple' && c.left.name === 'kind'));
      const expected = oldConditions.length === 1 ? oldConditions[0] : {type: 'and', conditions: oldConditions};
      assert.deepEqual(canonical(gates[i].conditions[1]), canonical(expected));
    }
    after.where = before.where;
    equivalentKindGates++;
  } else unchanged++;
  assert.deepEqual(canonical(after), canonical(before), `${entry.name}/${entry.variant}/${ctx.userID}`);
}
let focusedMetadata = 0;
const metadataCase = afterCases.find(c => c.name === 'events.forAgenda');
const fullCase = afterCases.find(c => c.name === 'events.byIdFull');
assert.ok(metadataCase && fullCase);
assert.deepEqual(metadataCase.args, fullCase.args);
for (const ctx of [current.OWNER, current.OUTSIDER, { userID: 'anon', email: '' }]) {
  const full = copy(current.buildQuery(fullCase, ctx).ast);
  const metadata = copy(current.buildQuery(metadataCase, ctx).ast);
  const removed = full.related.filter(r => r.subquery.alias === 'agenda_items');
  assert.equal(removed.length, 1);
  full.related = full.related.filter(r => r.subquery.alias !== 'agenda_items');
  assert.deepEqual(metadata, full);
  focusedMetadata++;
}
const result = { checks: unchanged + factored + indexedEndpoints + focusedMetadata + equivalentKindGates, unchangedPredicates: unchanged, authorizedParentFactorizations: factored, equivalentIndexedEndpointSelections: indexedEndpoints, authorizedMetadataProjections: focusedMetadata, equivalentIndexedKindGates: equivalentKindGates };
await mkdir('output/zero-performance/isolated-planning-proof-v6', { recursive: true });
await writeFile('output/zero-performance/isolated-planning-proof-v6/result.json', JSON.stringify(result));
console.log(JSON.stringify(result));
