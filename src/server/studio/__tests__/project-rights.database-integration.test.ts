import postgres from 'postgres';
import { isLocalTestDatabase } from '@/test/local-database';
import { expect, it } from 'vitest';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!isLocalTestDatabase(database))
  throw new Error('Studio rights tests require the local development database');

it('enforces group project rights, personal invitations, and rejected Whiteboards', async () => {
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
  try {
    await sql.begin(async tx => {
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
              (${personalProject},${personalOwner},null,'Personal fixture','single',5,0,0)`;
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

      await expect(
        tx.savepoint(async nested => {
          await nested`insert into studio_project(id,owner_id,title,kind,created_at,updated_at)
            values(${whiteboard},${owner},'Retired fixture','whiteboard',0,0)`;
        })
      ).rejects.toMatchObject({ code: '23514' });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
});
