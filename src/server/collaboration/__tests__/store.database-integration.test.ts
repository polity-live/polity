import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { schema } from '@/zero/schema';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { createStored, commitState, loadStored } from '../store';
import { authorizeStored } from '../service';
import { rows, lockAuthority } from '../transaction';
import { restoreVersionInTransaction } from '../commands';

const url = new URL(
  process.env.SUPABASE_DB_URL ??
    process.env.ZERO_UPSTREAM_DB ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Studio tests require local PostgreSQL');
if (process.env.COLLABORATION_TEST_DATABASE) {
  if (!/^polity_collaboration_[a-z0-9_]+$/.test(process.env.COLLABORATION_TEST_DATABASE))
    throw new Error('Invalid test database');
  url.pathname = '/' + process.env.COLLABORATION_TEST_DATABASE;
}
const provider = zeroPostgresJS(schema, url.toString());
type Tx = Parameters<Parameters<typeof provider.transaction>[0]>[0];
const rollback = new Error('rollback test fixture');
async function fixture(body: (tx: Tx, actor: string, entity: string) => Promise<void>) {
  try {
    await provider.transaction(async tx => {
      const sql = tx.dbTransaction;
      await lockAuthority(sql);
      await sql.query("update collaboration_control set phase='active' where singleton", []);
      const actor = crypto.randomUUID(),
        entity = crypto.randomUUID();
      await sql.query('insert into "user"(id) values($1)', [actor]);
      const value = createDocument('single', 'Studio original');
      await sql.query(
        "insert into studio_project(id,owner_id,title,kind,created_at,updated_at) values($1,$2,$3,'single',0,0)",
        [entity, actor, value.title]
      );
      await sql.query(
        'insert into studio_state(project_id,state,document,updated_at) values($1,$2,$3::jsonb,0)',
        [entity, Buffer.from([0, 0]), value]
      );
      await createStored(
        sql,
        { kind: 'studio', entityId: entity, branchId: null, workspaceId: null },
        value,
        actor
      );
      await body(tx, actor, entity);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function document(tx: Tx, entity: string) {
  const [row] = await rows<{ id: string }>(
    tx.dbTransaction,
    "select id from collaboration_document where kind='studio' and entity_id=$1 and workspace_id is null",
    [entity]
  );
  return loadStored(tx.dbTransaction, row.id);
}
async function edit(tx: Tx, actor: string, entity: string) {
  const original = await document(tx, entity),
    client = new Y.Doc();
  Y.applyUpdate(client, original.state);
  client.getMap('meta').set('title', 'Studio edited');
  const update = Y.encodeStateAsUpdate(client);
  client.destroy();
  await authorizeStored(tx, actor, original, original.generation, true);
  return {
    original,
    update,
    committed: await commitState(tx.dbTransaction, original, update, actor, 'test-edit'),
  };
}
describe('transactional Studio collaboration storage', () => {
  it('commits Yjs state, projection, revision and outbox together and deduplicates retries', () =>
    fixture(async (tx, actor, entity) => {
      const { original, update, committed } = await edit(tx, actor, entity);
      expect(committed.document.revision).toBe(2);
      const [source] = await rows<{ document: unknown }>(
        tx.dbTransaction,
        'select document from studio_state where project_id=$1',
        [entity]
      );
      expect(source.document).toEqual(committed.document.projection);
      expect(source.document).toMatchObject({ title: 'Studio edited' });
      expect(
        await rows(tx.dbTransaction, 'select id from collaboration_outbox where document_id=$1', [
          original.id,
        ])
      ).toHaveLength(2);
      const duplicate = await commitState(
        tx.dbTransaction,
        await loadStored(tx.dbTransaction, original.id),
        update,
        actor,
        'test-edit'
      );
      expect(duplicate.duplicate).toBe(true);
      expect(duplicate.document.revision).toBe(2);
    }));
  it('rechecks current ownership and generation instead of trusting a session', () =>
    fixture(async (tx, actor, entity) => {
      const stored = await document(tx, entity),
        other = crypto.randomUUID();
      await tx.dbTransaction.query('insert into "user"(id) values($1)', [other]);
      await tx.dbTransaction.query('update studio_project set owner_id=$1 where id=$2', [
        other,
        entity,
      ]);
      await expect(authorizeStored(tx, actor, stored, stored.generation, true)).rejects.toThrow(
        'access_denied'
      );
      const latest = await document(tx, entity);
      expect(latest.generation).not.toBe(stored.generation);
      await expect(authorizeStored(tx, other, latest, stored.generation, true)).rejects.toThrow(
        'generation_changed'
      );
      await expect(
        authorizeStored(tx, other, latest, latest.generation, true)
      ).resolves.toBeTruthy();
    }));
  it('rejects old content overwrites and changes to immutable revisions in SQL', () =>
    fixture(async (tx, _actor, entity) => {
      const stored = await document(tx, entity),
        sql = tx.dbTransaction;
      await sql.query('savepoint rejected', []);
      await expect(
        sql.query("update studio_state set document='{}' where project_id=$1", [entity])
      ).rejects.toThrow('collaboration_legacy_write_rejected');
      await sql.query('rollback to savepoint rejected', []);
      await expect(
        sql.query("update collaboration_revision set reason='changed' where document_id=$1", [
          stored.id,
        ])
      ).rejects.toThrow('collaboration_revision_immutable');
      await sql.query('rollback to savepoint rejected', []);
      expect((await document(tx, entity)).revision).toBe(1);
    }));
  it('restores a server-held version as a new generation and deduplicates the operation', () =>
    fixture(async (tx, actor, entity) => {
      const { original, committed } = await edit(tx, actor, entity);
      const command = {
        id: original.id,
        generation: committed.document.generation,
        expectedRevision: 2,
        operationId: crypto.randomUUID(),
        value: original.projection,
      };
      const result = await restoreVersionInTransaction(tx, actor, command),
        restored = await document(tx, entity);
      expect(Number(result.revision)).toBe(3);
      expect(restored.projection).toEqual(original.projection);
      expect(restored.generation).not.toBe(original.generation);
      expect(await restoreVersionInTransaction(tx, actor, command)).toEqual(result);
      await expect(
        restoreVersionInTransaction(tx, actor, { ...command, value: committed.document.projection })
      ).rejects.toThrow('operation_id_reused');
    }));
  it('does not restore arbitrary client content that has no server-held version', () =>
    fixture(async (tx, actor, entity) => {
      const original = await document(tx, entity);
      await expect(
        restoreVersionInTransaction(tx, actor, {
          id: original.id,
          generation: original.generation,
          expectedRevision: 1,
          operationId: crypto.randomUUID(),
          value: createDocument('single', 'Unrecorded'),
        })
      ).rejects.toThrow('version_not_found');
    }));
});
