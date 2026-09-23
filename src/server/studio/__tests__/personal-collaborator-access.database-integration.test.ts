import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { expect, it } from 'vitest';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (
  !['localhost', '127.0.0.1'].includes(new URL(database).hostname) ||
  new URL(database).port !== '54322'
)
  throw new Error('Personal Studio access tests require the local development database');

it('grants edit only after acceptance and removes it on decline or revocation', async () => {
  const sql = postgres(database, { max: 1 });
  const rollback = new Error('rollback test fixtures');
  const owner = crypto.randomUUID();
  const guest = crypto.randomUUID();
  const project = crypto.randomUUID();
  const invitation = crypto.randomUUID();
  try {
    await sql.begin(async tx => {
      const [table] = await tx`select to_regclass('public.studio_project_collaborator') as name`;
      if (!table.name) {
        const migration = readFileSync(
          'supabase/migrations/20260923050000_personal_studio_collaborators.sql',
          'utf8'
        );
        await tx.unsafe(migration);
      }
      await tx`insert into "user"(id) values(${owner}),(${guest})`;
      await tx`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at)
        values(${project},${owner},null,'Access test','single',5,0,0)`;
      await tx`insert into studio_project_collaborator(id,project_id,user_id,invited_by_id,status,created_at,updated_at)
        values(${invitation},${project},${guest},${owner},'invited',0,0)`;
      const access = async () => {
        const [row] = await tx`select studio_access(${guest}::uuid,${project}::uuid,false) as read,
          studio_access(${guest}::uuid,${project}::uuid,true) as edit,
          canvas_manage(${guest}::uuid,${project}::uuid) as manage`;
        return row;
      };
      expect(await access()).toMatchObject({ read: false, edit: false, manage: false });
      await tx`update studio_project_collaborator set status='active' where id=${invitation}`;
      expect(await access()).toMatchObject({ read: true, edit: true, manage: false });
      await tx`update studio_project_collaborator set status='declined' where id=${invitation}`;
      expect(await access()).toMatchObject({ read: false, edit: false, manage: false });
      await tx`delete from studio_project_collaborator where id=${invitation}`;
      expect(await access()).toMatchObject({ read: false, edit: false, manage: false });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
});
