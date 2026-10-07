import { assertStudioAccess, assertStudioCollaborationAccess, studioSql, StudioError } from './db';
import { assertProjectAiSourceSharing } from './ai-sources';

async function ownedProject(actor: string, id: string) {
  const sql = studioSql();
  await assertStudioAccess(actor, id, true, sql);
  const [project] =
    await sql`select owner_id,group_id from studio_project where id=${id} for update`;
  if (!project || (project.group_id === null && project.owner_id !== actor))
    throw new StudioError('Only the project owner can manage this project', 403);
  return sql;
}
export async function setProjectVisibility(actor: string, id: string, visibility: string) {
  const sql = await ownedProject(actor, id);
  await assertProjectAiSourceSharing(
    id,
    [],
    visibility as 'public' | 'authenticated' | 'private',
    sql
  );
  await sql`update studio_project set visibility=${visibility},updated_at=${Date.now()} where id=${id}`;
  return { ok: true };
}
export async function setProjectTemplate(actor: string, id: string, value: boolean) {
  const sql = await ownedProject(actor, id);
  await sql`update studio_project set is_template=${value} where id=${id}`;
  return { ok: true };
}
export async function deleteStudioProject(actor: string, id: string) {
  const sql = await ownedProject(actor, id);
  const [used] =
    await sql`select s.id from statement s join studio_export e on (s.image_url='/api/studio/published-media/' || e.id::text or s.video_url='/api/studio/published-media/' || e.id::text) where e.project_id=${id} limit 1`;
  if (used) throw new StudioError('This project contains media used by a Polity post');
  const [pending] =
    await sql`select id from studio_export where project_id=${id} and status in ('queued','running') limit 1`;
  if (pending) throw new StudioError('Cancel pending exports before deleting the project');
  await sql`delete from studio_project where id=${id}`;
  return { ok: true };
}
export async function cancelStudioExport(actor: string, id: string) {
  const sql = studioSql();
  const [job] = await sql`select project_id from studio_export where id=${id}`;
  if (!job) throw new StudioError('Export not found', 404);
  await assertStudioAccess(actor, job.project_id, true, sql);
  await sql`update studio_export set status='cancelled',updated_at=${Date.now()} where id=${id} and status in ('queued','running')`;
  return { ok: true };
}
export async function claimEditorActions(actor: string, projectId: string, clientId: string) {
  const sql = studioSql();
  await assertStudioCollaborationAccess(actor, projectId, sql);
  return sql`update studio_editor_action set claimed_by=${clientId} where id in (select id from studio_editor_action where project_id=${projectId} and actor_id=${actor} and result is null and (claimed_by is null or claimed_by=${clientId}) and created_at>${Date.now() - 120000} order by created_at limit 20 for update skip locked) returning id,name,input`;
}
export async function completeEditorAction(
  actor: string,
  input: { projectId: string; id: string; clientId: string; result: object }
) {
  const sql = studioSql();
  await assertStudioCollaborationAccess(actor, input.projectId, sql);
  const [claimed] =
    await sql`select claimed_by,result from studio_editor_action where id=${input.id} and project_id=${input.projectId} and actor_id=${actor} for update`;
  if (!claimed || claimed.claimed_by !== input.clientId)
    throw new StudioError('Editor action is claimed by another client', 403);
  await sql`update studio_editor_action set result=${sql.json(input.result as never)} where id=${input.id} and result is null`;
  return { status: 'acknowledged' };
}
