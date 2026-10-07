import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createZeroContext,
  executeZeroTransaction,
  type ZeroTransaction,
} from '@/server/zero-mutate';
import { rows, sqlTransaction } from '@/server/transaction';
import { amendmentServerMutators } from '../server-mutators';
import { documentServerMutators } from '@/zero/documents/server-mutators';

const database = new URL(
  process.env.ZERO_UPSTREAM_DB ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
  throw Error('Revision tests require isolated local PostgreSQL');
const actor = crypto.randomUUID(),
  amendment = crypto.randomUUID(),
  document = crypto.randomUUID(),
  design = crypto.randomUUID();
const ctx = createZeroContext(actor);
const transaction = <T>(work: (tx: ZeroTransaction) => Promise<T>) =>
  executeZeroTransaction(ctx, work);
const query = (text: string, values: unknown[] = []) =>
  transaction(tx => rows(sqlTransaction(tx), text, values));

beforeAll(async () => {
  await query('insert into "user"(id) values($1)', [actor]);
  await query(
    "insert into amendment(id,created_by_id,title,visibility) values($1,$2,'Revision boundaries','private')",
    [amendment, actor]
  );
  await query(
    "insert into document(id,amendment_id,editing_mode,content) values($1,$2,'edit',$3::jsonb)",
    [document, amendment, JSON.stringify([{ type: 'p', children: [{ text: 'Original' }] }])]
  );
  await query('update amendment set document_id=$2 where id=$1', [amendment, document]);
  await query(
    "insert into amendment_city_design(id,amendment_id,created_by_id,title,design_state) values($1,$2,$3,'Original',$4::jsonb)",
    [design, amendment, actor, JSON.stringify({ objects: [] })]
  );
});
afterAll(async () => {
  await query('delete from amendment_city_design where id=$1', [design]);
  await query('update amendment set document_id=null where id=$1', [amendment]);
  await query('delete from document where id=$1', [document]);
  await query('delete from amendment where id=$1', [amendment]);
  await query('delete from "user" where id=$1', [actor]);
});

it('commits city design content once at the expected revision', async () => {
  const state = { objects: [{ id: crypto.randomUUID(), type: 'tree' }] };
  await transaction(tx =>
    amendmentServerMutators.updateCityDesign.fn({
      tx,
      ctx,
      args: { id: design, design_state: state, expected_content_revision: 0 },
    })
  );
  expect(
    await query('select design_state,content_revision from amendment_city_design where id=$1', [
      design,
    ])
  ).toEqual([{ design_state: state, content_revision: 1 }]);
});

it('rejects a stale city design save without replacing committed content', async () => {
  const before = await query(
    'select design_state,content_revision from amendment_city_design where id=$1',
    [design]
  );
  await expect(
    transaction(tx =>
      amendmentServerMutators.updateCityDesign.fn({
        tx,
        ctx,
        args: { id: design, design_state: { objects: [] }, expected_content_revision: 0 },
      })
    )
  ).rejects.toThrow();
  expect(
    await query('select design_state,content_revision from amendment_city_design where id=$1', [
      design,
    ])
  ).toEqual(before);
});

it('updates city design metadata without advancing its content revision', async () => {
  await transaction(tx =>
    amendmentServerMutators.updateCityDesign.fn({ tx, ctx, args: { id: design, title: 'Renamed' } })
  );
  expect(
    await query('select title,content_revision from amendment_city_design where id=$1', [design])
  ).toEqual([{ title: 'Renamed', content_revision: 1 }]);
});

it('changes document editing mode without replacing content or advancing its revision', async () => {
  const before = await query('select content,content_revision from document where id=$1', [
    document,
  ]);
  await transaction(tx =>
    documentServerMutators.updateContent.fn({
      tx,
      ctx,
      args: { id: document, editing_mode: 'view' },
    })
  );
  expect(
    await query('select content,content_revision from document where id=$1', [document])
  ).toEqual(before);
  expect(await query('select editing_mode from document where id=$1', [document])).toEqual([
    { editing_mode: 'view' },
  ]);
});
