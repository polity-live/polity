import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { assertStudioAccess, studioSql } from './db';

/** Canonical document only. Drafts, collaboration state and exports stay private. */
export async function readStudioProject(request: Request, id: string) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!z.string().uuid().safeParse(id).success)
    return Response.json({ error: 'Project not found' }, { status: 404, headers });
  const session = await getSession(request);
  const sql = studioSql();
  try {
    await assertStudioAccess(session?.user.id ?? null, id, false, sql);
  } catch {
    return Response.json({ error: 'Project not found' }, { status: 404, headers });
  }
  const [project] = await sql`
    select p.id,p.title,p.kind,p.group_id,p.owner_id,p.visibility,s.document
    from studio_project p join studio_state s on s.project_id=p.id
    where p.id=${id} and p.document_schema_version=5`;
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404, headers });
  const assets = await sql`
    select id,name,mime_type from studio_asset
    where project_id=${id} and workspace_id is null and ready=true`;
  const [rights] =
    await sql`select public.studio_access(${session?.user.id ?? null}::uuid,${id}::uuid,true) as can_edit`;
  return Response.json(
    {
      project: {
        id: project.id,
        title: project.title,
        kind: project.kind,
        groupId: project.group_id,
        ownerId: project.owner_id,
        visibility: project.visibility,
        canEdit: Boolean(rights?.can_edit),
        canManageVisibility:
          Boolean(rights?.can_edit) &&
          (project.group_id !== null || project.owner_id === session?.user.id),
      },
      document: project.document,
      assets: assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        mime: asset.mime_type,
        url: `/api/studio/media/${asset.id}`,
      })),
    },
    { headers }
  );
}
