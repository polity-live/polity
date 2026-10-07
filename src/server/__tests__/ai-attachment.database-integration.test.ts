import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { rows, sqlTransaction } from '@/server/transaction';
import { resolveAiAttachmentForUser } from '@/server/ai-tools';
import * as zeroRuntime from '@/server/zero-mutate';
import { studioSql } from '@/server/studio/db';

const database = new URL(
  process.env.ZERO_UPSTREAM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
  throw new Error('Attachment access tests require isolated local PostgreSQL');

const entityTypes = [
  'user',
  'group',
  'statement',
  'blog',
  'amendment',
  'event',
  'todo',
  'election',
  'vote',
  'document',
] as const;
type Entity = (typeof entityTypes)[number];
const actor = crypto.randomUUID(),
  owner = crypto.randomUUID();
const ids = Object.fromEntries(
  entityTypes.map(type => [type, type === 'user' ? owner : crypto.randomUUID()])
) as Record<Entity, string>;
const relations = {
  group: ['group_membership', 'group_id'],
  event: ['event_participant', 'event_id'],
  amendment: ['amendment_collaborator', 'amendment_id'],
  blog: ['blog_blogger', 'blog_id'],
} as const;
const transaction = <T>(work: (tx: ZeroTransaction) => Promise<T>) =>
  executeZeroTransaction(createZeroContext(actor), work);
const query = (sql: string, args: unknown[] = []) =>
  transaction(tx => rows(sqlTransaction(tx), sql, args));
const table = (type: Entity) => (type === 'user' ? '"user"' : type === 'group' ? '"group"' : type);

afterEach(() => vi.restoreAllMocks());

beforeAll(async () => {
  await query(
    "insert into \"user\"(id,first_name,last_name,visibility) values($1,'Server','Viewer','public'),($2,'Server','Owner','public')",
    [actor, owner]
  );
  await query(
    "insert into \"group\"(id,owner_id,name,visibility) values($1,$2,'Server group','public')",
    [ids.group, owner]
  );
  await query(
    "insert into statement(id,user_id,text,visibility) values($1,$2,'Server statement','public')",
    [ids.statement, owner]
  );
  await query("insert into blog(id,title,visibility) values($1,'Server blog','public')", [
    ids.blog,
  ]);
  await query(
    "insert into amendment(id,created_by_id,title,visibility) values($1,$2,'Server amendment','public')",
    [ids.amendment, owner]
  );
  await query(
    "insert into event(id,creator_id,title,visibility) values($1,$2,'Server event','public')",
    [ids.event, owner]
  );
  await query(
    "insert into todo(id,creator_id,title,visibility) values($1,$2,'Server todo','public')",
    [ids.todo, owner]
  );
  await query("insert into election(id,title,visibility) values($1,'Server election','public')", [
    ids.election,
  ]);
  await query(
    "insert into vote(id,title,purpose,visibility) values($1,'Server vote','closing','public')",
    [ids.vote]
  );
  await query('insert into document(id,amendment_id,content) values($1,$2,$3::jsonb)', [
    ids.document,
    ids.amendment,
    [{ type: 'p', children: [{ text: 'Canonical document content' }] }],
  ]);
});

beforeEach(async () => {
  await transaction(async tx => {
    const sql = sqlTransaction(tx);
    for (const type of entityTypes)
      if (type !== 'document')
        await sql.query(`update ${table(type)} set visibility='public' where id=$1`, [ids[type]]);
    for (const [relation] of Object.values(relations))
      await sql.query(`delete from ${relation} where user_id=$1`, [actor]);
    await sql.query('delete from todo_assignment where user_id=$1', [actor]);
    await sql.query('update document set amendment_id=$2 where id=$1', [
      ids.document,
      ids.amendment,
    ]);
    await sql.query("update amendment set title='Server amendment' where id=$1", [ids.amendment]);
  });
});

afterAll(async () => {
  for (const [relation] of Object.values(relations))
    await query(`delete from ${relation} where user_id=$1`, [actor]);
  await query('delete from todo_assignment where user_id=$1', [actor]);
  for (const type of [
    'document',
    'vote',
    'election',
    'todo',
    'event',
    'amendment',
    'blog',
    'statement',
    'group',
  ] as const)
    await query(`delete from ${table(type)} where id=$1`, [ids[type]]);
  await query('delete from "user" where id in ($1,$2)', [actor, owner]);
});

const visibility = (type: Entity, value: string) =>
  query(`update ${table(type === 'document' ? 'amendment' : type)} set visibility=$2 where id=$1`, [
    ids[type === 'document' ? 'amendment' : type],
    value,
  ]);
const resolve = (type: Entity, user = actor, id = ids[type]) =>
  resolveAiAttachmentForUser(user, { entityType: type, entityId: id });
async function relate(type: keyof typeof relations, status = 'active') {
  const [relation, key] = relations[type];
  await query(`insert into ${relation}(${key},user_id,status) values($1,$2,$3)`, [
    ids[type],
    actor,
    status,
  ]);
}

it.each(entityTypes)('loads a public %s attachment from canonical database rows', async type => {
  const attachment = await resolve(type);
  expect(attachment).toMatchObject({ entityType: type, entityId: ids[type] });
  expect(attachment!.title).toContain(type === 'document' ? 'Datei zu Server amendment' : 'Server');
  if (type === 'document')
    expect(attachment!.prompt_context).toContain('Canonical document content');
});

it.each(entityTypes)(
  'loads an authenticated %s attachment for the requesting signed-in actor',
  async type => {
    await visibility(type, 'authenticated');
    expect(await resolve(type)).toMatchObject({ entityType: type, entityId: ids[type] });
  }
);

it.each(entityTypes)(
  'rejects a private %s attachment when its actor has no qualifying relationship',
  async type => {
    await visibility(type, 'private');
    expect(await resolve(type)).toBeNull();
  }
);

it.each(entityTypes)('returns no %s attachment for a missing canonical identity', async type => {
  expect(await resolve(type, actor, crypto.randomUUID())).toBeNull();
});

it.each(['user', 'statement', 'todo'] as const)(
  'allows a private %s attachment belonging to the requesting actor',
  async type => {
    await visibility(type, 'private');
    expect(await resolve(type, owner)).toMatchObject({ entityType: type, entityId: ids[type] });
  }
);

it.each(['group', 'event', 'amendment', 'blog', 'document'] as const)(
  'allows a private %s attachment with a current active relationship',
  async type => {
    await visibility(type, 'private');
    await relate(type === 'document' ? 'amendment' : type);
    expect(await resolve(type)).toMatchObject({ entityType: type, entityId: ids[type] });
  }
);

it('allows a private todo assigned to the actor while preserving its canonical creator', async () => {
  await visibility('todo', 'private');
  await query('insert into todo_assignment(todo_id,user_id) values($1,$2)', [ids.todo, actor]);
  expect(await resolve('todo')).toMatchObject({
    entityType: 'todo',
    entityId: ids.todo,
    title: 'Server todo',
  });
  expect((await query('select creator_id from todo where id=$1', [ids.todo]))[0].creator_id).toBe(
    owner
  );
});

it.each(['group', 'event', 'amendment', 'blog'] as const)(
  'preserves valid legacy role statuses for private %s attachments',
  async type => {
    await visibility(type, 'private');
    const [relation] = relations[type];
    const statuses =
      type === 'group'
        ? ['member', 'admin']
        : type === 'event'
          ? ['confirmed', 'member', 'admin']
          : type === 'amendment'
            ? ['collaborator', 'member', 'admin']
            : ['owner', 'admin', 'member', 'writer'];
    for (const status of statuses) {
      await relate(type, status);
      expect(await resolve(type), `relationship ${status}`).toMatchObject({
        entityType: type,
        entityId: ids[type],
      });
      await query(`delete from ${relation} where user_id=$1`, [actor]);
    }
  }
);

it.each(['group', 'event', 'amendment', 'blog', 'document'] as const)(
  'denies a private %s attachment after its relationship is pending or removed',
  async type => {
    await visibility(type, 'private');
    const kind = type === 'document' ? 'amendment' : type;
    const [relation] = relations[kind];
    for (const status of ['requested', 'invited', 'removed']) {
      await relate(kind, status);
      expect(await resolve(type), `relationship ${status}`).toBeNull();
      await query(`delete from ${relation} where user_id=$1`, [actor]);
    }
  }
);

it('rejects a document with no current amendment and uses a readable title when its canonical amendment is unnamed', async () => {
  await query('update document set amendment_id=null where id=$1', [ids.document]);
  expect(await resolve('document')).toBeNull();
  await query('update document set amendment_id=$2 where id=$1', [ids.document, ids.amendment]);
  await query('update amendment set title=null where id=$1', [ids.amendment]);
  expect(await resolve('document')).toMatchObject({ title: 'Datei' });
});

it('does not invent canonical content for attachment types without a supported row resolver', async () => {
  expect(
    await resolveAiAttachmentForUser(actor, {
      entityType: 'payment',
      entityId: crypto.randomUUID(),
    })
  ).toBeNull();
});

it('returns no document content when its canonical amendment disappears between the two database reads', async () => {
  const originalRead = zeroRuntime.executeZeroRead;
  let removed = false;
  vi.spyOn(zeroRuntime, 'executeZeroRead').mockImplementation(callback =>
    originalRead(async tx => {
      const nativeQuery = tx.dbTransaction.query.bind(tx.dbTransaction);
      const boundary = vi
        .spyOn(tx.dbTransaction, 'query')
        .mockImplementation(async (statement, args) => {
          const result = await nativeQuery(statement, args);
          if (
            !removed &&
            /\bfrom\s+(?:(?:"public"|public)\.)?(?:"document"|document)(?:\s|$)/i.test(statement)
          ) {
            removed = true;
            await studioSql().unsafe('delete from amendment where id=$1', [ids.amendment]);
          }
          return result;
        });
      try {
        return await callback(tx);
      } finally {
        boundary.mockRestore();
      }
    })
  );
  expect(await resolve('document')).toBeNull();
  expect(removed).toBe(true);
});
