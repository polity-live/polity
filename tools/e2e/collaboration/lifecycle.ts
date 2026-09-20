import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { dbProvider } from '../../../src/zero/db-provider';
import {
  migrateDocuments,
  activateMigration,
  governanceManifest,
} from '../../../src/server/collaboration/migration';
import { enterCompatibility } from '../../../src/server/collaboration/rollback';
import {
  rows,
  lockAuthority,
  type SqlTransaction,
} from '../../../src/server/collaboration/transaction';
import { loadStored, commitState } from '../../../src/server/collaboration/store';
import { reconcileProjection } from '../../../src/features/collaboration/logic/reconcile';
import { stableJson } from '../../../src/features/collaboration/logic/codec';
import type { Value } from 'platejs';

/** Destructive rehearsal only on a fresh, explicitly named local acceptance copy.
 * Each step commits independently, including both rollback paths. */
export async function rehearseLifecycle() {
  const url = new URL(process.env.ZERO_UPSTREAM_DB || '');
  assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '54322');
  assert.match(url.pathname, /^\/polity_collaboration_acceptance_\d+$/);
  const transaction = <T>(body: (sql: SqlTransaction) => Promise<T>) =>
    dbProvider.transaction(async tx => {
      await lockAuthority(tx.dbTransaction);
      await tx.dbTransaction.query(
        "select set_config('polity.collaboration_migration','on',true)",
        []
      );
      return body(tx.dbTransaction);
    });
  const started = Date.now();
  const control = await transaction(sql =>
    rows<{ phase: string; activated_at: number | null }>(
      sql,
      'select phase,activated_at from collaboration_control where singleton'
    )
  );
  assert.equal(control[0].phase, 'legacy');
  assert.equal(control[0].activated_at, null);
  const source = await transaction(sql => rows(sql, 'select id,content from document order by id'));
  const governance = await transaction(governanceManifest);
  const first = crypto.randomUUID();
  const begin = (id: string) =>
    transaction(sql =>
      sql.query(
        "update collaboration_control set phase='maintenance',migration_id=$1 where singleton",
        [id]
      )
    );
  const convert = (id: string) =>
    transaction(async sql => {
      const manifest = await migrateDocuments(sql, id);
      await sql.query('update collaboration_control set manifest=$1::jsonb where singleton', [
        manifest,
      ]);
      return manifest;
    });
  await begin(first);
  const prepared = await convert(first);
  assert.deepEqual(await convert(first), prepared, 'A committed conversion is repeatable');
  await transaction(async sql => {
    await sql.query("update collaboration_migration_attempt set status='aborted' where id=$1", [
      first,
    ]);
    await sql.query(
      "update collaboration_control set phase='legacy',manifest=null where singleton",
      []
    );
  });
  assert.deepEqual(
    await transaction(sql => rows(sql, 'select id,content from document order by id')),
    source,
    'Abort before opening preserves the legacy text'
  );
  assert.deepEqual(await transaction(governanceManifest), governance);
  const [personal] = await transaction(sql =>
    rows<{ id: string; content: Value }>(
      sql,
      'select id,content from document where amendment_id is null order by id limit 1'
    )
  );
  assert(personal, 'Seed a personal legacy document');
  const edited = [
    ...personal.content,
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [{ text: 'Legacy edit after committed abort' }],
    },
  ];
  await transaction(sql =>
    sql.query('update document set content=$2::jsonb where id=$1', [personal.id, edited])
  );
  const second = crypto.randomUUID();
  await begin(second);
  const retried = await convert(second);
  assert.notEqual(retried.contentChecksum, prepared.contentChecksum);
  await transaction(sql => activateMigration(sql, second, 60_000));
  assert.deepEqual(await transaction(governanceManifest), governance);
  const [document] = await transaction(sql =>
    rows<{ id: string; owner: string }>(
      sql,
      "select d.id,c.user_id as owner from collaboration_document d join document_collaborator c on c.document_id=d.entity_id where d.kind='document' and d.entity_id=$1 and d.workspace_id is null and c.status='active' limit 1",
      [personal.id]
    )
  );
  assert(document);
  const confirmed = await transaction(async sql => {
    const doc = await loadStored(sql, document.id);
    assert.equal(stableJson(doc.projection), stableJson(edited));
    const next = [
      ...edited,
      { id: crypto.randomUUID(), type: 'p', children: [{ text: 'Confirmed after reopening' }] },
    ];
    return commitState(
      sql,
      doc,
      reconcileProjection('document', doc.state, next),
      document.owner,
      'rehearsal-confirmed'
    );
  });
  const beforeRollback = await transaction(sql =>
    rows(
      sql,
      'select id,revision,checksum,projection,branch_id,workspace_id from collaboration_document order by id'
    )
  );
  const history = await transaction(sql =>
    rows(sql, 'select * from collaboration_revision order by id')
  );
  await begin(second);
  await transaction(sql => enterCompatibility(sql, 60_000));
  assert.deepEqual(
    await transaction(sql =>
      rows(
        sql,
        'select id,revision,checksum,projection,branch_id,workspace_id from collaboration_document order by id'
      )
    ),
    beforeRollback
  );
  assert.deepEqual(
    await transaction(sql => rows(sql, 'select * from collaboration_revision order by id')),
    history
  );
  assert.deepEqual(await transaction(governanceManifest), governance);
  const reopened = await transaction(sql => loadStored(sql, document.id));
  assert.equal(reopened.revision, confirmed.document.revision);
  assert.notEqual(reopened.generation, confirmed.document.generation);
  const result = {
    passed: true,
    database: url.pathname,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    firstAttempt: first,
    secondAttempt: second,
    documents: beforeRollback.length,
    revisions: history.length,
    checks: [
      'committed-conversion-repeat',
      'abort-before-reopening',
      'legacy-edit-and-new-attempt',
      'immutable-governance',
      'confirmed-edit-after-reopening',
      'compatibility-retains-all-revisions-and-branches',
    ],
  };
  writeFileSync('output/collaboration-migration/lifecycle.json', JSON.stringify(result, null, 2));
  return result;
}
