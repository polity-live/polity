import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { isLocalTestDatabase } from '@/test/local-database';
import { expect, it } from 'vitest';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!isLocalTestDatabase(database))
  throw new Error('Studio rights tests require the local development database');

it('enforces group project rights, personal invitations, and retired Whiteboard media', async () => {
  const sql = postgres(database, { max: 1 });
  const rollback = new Error('rollback Studio fixtures');
  const [owner, creator, viewer, manager, noRights, personalOwner, invited] = Array.from(
    { length: 7 },
    () => crypto.randomUUID()
  );
  const group = crypto.randomUUID();
  const [viewRole, manageRole, legacyRole] = Array.from({ length: 3 }, () => crypto.randomUUID());
  const [groupProject, personalProject, whiteboard] = Array.from({ length: 3 }, () =>
    crypto.randomUUID()
  );
  const exportId = crypto.randomUUID();
  const exportPath = `${whiteboard}/exports/published.png`;
  const discardedPath = `${whiteboard}/assets/discarded.png`;
  try {
    await sql.begin(async tx => {
      await tx.unsafe(
        readFileSync('supabase/migrations/20260923060000_group_studio_project_rights.sql', 'utf8')
      );
      // Recreate the pre-retirement constraint so this migration test also runs
      // against a local database where the retirement has already been applied.
      await tx`alter table studio_project drop constraint studio_project_kind_check`;
      await tx`alter table studio_project add constraint studio_project_kind_check
        check (kind in ('single','event','carousel','story','video','campaign','whiteboard'))`;
      for (const id of [owner, creator, viewer, manager, noRights, personalOwner, invited])
        await tx`insert into "user"(id) values(${id})`;
      await tx`insert into "group"(id,name,owner_id) values(${group},'Project rights fixture',${owner})`;
      for (const [actor, role, resource, action] of [
        [viewer, viewRole, 'projects', 'view'],
        [manager, manageRole, 'projects', 'manage'],
        [noRights, legacyRole, 'communicationStudio', 'manage'],
      ]) {
        const membership = crypto.randomUUID();
        await tx`insert into group_membership(id,group_id,user_id,status) values(${membership},${group},${actor},'admin')`;
        await tx`insert into role(id,name,scope,group_id) values(${role},'Fixture','group',${group})`;
        await tx`insert into group_membership_role(group_membership_id,role_id) values(${membership},${role})`;
        await tx`insert into action_right(resource,action,role_id,group_id) values(${resource},${action},${role},${group})`;
      }
      await tx`insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at)
        values(${groupProject},${creator},${group},'Group fixture','single',5,0,0),
              (${personalProject},${personalOwner},null,'Personal fixture','single',5,0,0),
              (${whiteboard},${owner},${group},'Retired fixture','whiteboard',5,0,0)`;
      await tx`insert into studio_project_collaborator(id,project_id,user_id,invited_by_id,status,created_at,updated_at)
        values(${crypto.randomUUID()},${personalProject},${invited},${personalOwner},'invited',0,0)`;
      const access = async (actor: string, project: string) => {
        const [row] = await tx`select studio_access(${actor}::uuid,${project}::uuid,false) as view,
          studio_access(${actor}::uuid,${project}::uuid,true) as edit,
          canvas_manage(${actor}::uuid,${project}::uuid) as manage`;
        return row;
      };
      expect(await access(owner, groupProject)).toMatchObject({
        view: true,
        edit: true,
        manage: true,
      });
      expect(await access(creator, groupProject)).toMatchObject({
        view: true,
        edit: true,
        manage: true,
      });
      expect(await access(viewer, groupProject)).toMatchObject({
        view: true,
        edit: false,
        manage: false,
      });
      expect(await access(manager, groupProject)).toMatchObject({
        view: true,
        edit: true,
        manage: true,
      });
      expect(await access(noRights, groupProject)).toMatchObject({
        view: false,
        edit: false,
        manage: false,
      });
      expect(await access(invited, personalProject)).toMatchObject({ view: false, edit: false });
      await tx`update studio_project_collaborator set status='active' where project_id=${personalProject}`;
      expect(await access(invited, personalProject)).toMatchObject({
        view: true,
        edit: true,
        manage: false,
      });
      await tx`update studio_project_collaborator set status='declined' where project_id=${personalProject}`;
      expect(await access(invited, personalProject)).toMatchObject({ view: false, edit: false });

      const revision = crypto.randomUUID();
      await tx`insert into studio_revision(id,project_id,document,created_by_id,created_at)
        values(${revision},${whiteboard},'{}'::jsonb,${owner},0)`;
      await tx`insert into studio_export(id,project_id,revision_id,requested_by_id,format,status,storage_path,file_name,created_at,updated_at)
        values(${exportId},${whiteboard},${revision},${owner},'png','completed',${exportPath},'published.png',0,0)`;
      await tx`insert into statement(user_id,title,image_url,media_type)
        values(${owner},'Published',${`/api/studio/published-media/${exportId}`},'image')`;
      await tx`insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,created_at)
        values(${crypto.randomUUID()},${whiteboard},'discarded.png','image/png',10,${discardedPath},0)`;
      await tx.unsafe(
        readFileSync('supabase/migrations/20260923061000_retire_whiteboards.sql', 'utf8')
      );
      const [retired] = await tx`select id from studio_project where id=${whiteboard}`;
      const [archive] =
        await tx`select storage_path from studio_published_media_archive where id=${exportId}`;
      const [queued] =
        await tx`select storage_path from studio_whiteboard_storage_manifest where storage_path=${exportPath}`;
      const [discarded] =
        await tx`select storage_path from studio_whiteboard_storage_manifest where storage_path=${discardedPath}`;
      expect(retired).toBeUndefined();
      expect(archive?.storage_path).toBe(exportPath);
      expect(queued).toBeUndefined();
      expect(discarded?.storage_path).toBe(discardedPath);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
});
