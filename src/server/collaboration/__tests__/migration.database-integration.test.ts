import { expect, it } from 'vitest';
import postgres from 'postgres';
const url = new URL(
  process.env.SUPABASE_DB_URL ??
    process.env.ZERO_UPSTREAM_DB ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Rollback tests require local PostgreSQL');
const sql = postgres(url.toString(), { max: 1 });
it('removes migration fences from legacy editors while retaining Studio authority', async () => {
  try {
    const triggers =
      await sql`select t.tgname,c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid where t.tgname like 'collaboration_%' and c.relname in ('document','blog','amendment','amendment_city_design','vote','change_request','studio_state')`;
    expect(triggers.filter(t => t.relname !== 'studio_state')).toEqual([]);
    expect(triggers.map(t => t.tgname)).toEqual(
      expect.arrayContaining([
        'collaboration_authority',
        'collaboration_studio_content',
        'collaboration_initialize',
      ])
    );
    const constraints =
      await sql`select conname from pg_constraint where conrelid='collaboration_document'::regclass and conname='collaboration_studio_scope'`;
    expect(constraints).toHaveLength(1);
  } finally {
    await sql.end();
  }
});
