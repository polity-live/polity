import { createNotification } from '@/features/notifications/utils/notification-helpers';
import { translate } from '@/features/shared/hooks/use-translation';
import type postgres from 'postgres';
import { studioTransaction, StudioError } from './db';
import { assertProjectAiSourceSharing } from './ai-sources';

interface ProjectRow {
  id: string;
  title: string;
  owner_id: string;
  group_id: string | null;
  kind: string;
}

async function ownerProject(sql: postgres.TransactionSql, actor: string, projectId: string) {
  const [project] = await sql<ProjectRow[]>`
    select id,title,owner_id,group_id,kind from studio_project
    where id=${projectId} and document_schema_version=5 for update`;
  if (!project || project.owner_id !== actor || project.group_id)
    throw new StudioError(
      'Only the owner of a personal Studio project can manage collaborators',
      403
    );
  return project;
}

export async function listStudioCollaborators(actor: string, projectId: string) {
  return studioTransaction(async sql => {
    await ownerProject(sql, actor, projectId);
    return sql`
      select c.id,c.user_id,c.status,u.first_name,u.last_name,u.handle,u.avatar
      from studio_project_collaborator c join "user" u on u.id=c.user_id
      where c.project_id=${projectId} order by c.created_at`;
  });
}

export async function listMyStudioInvitations(actor: string) {
  return studioTransaction(
    async sql => sql`
    select c.id,c.project_id,p.title,p.owner_id,u.first_name,u.last_name,u.handle
    from studio_project_collaborator c
    join studio_project p on p.id=c.project_id
    join "user" u on u.id=p.owner_id
    where c.user_id=${actor} and c.status='invited'
      and p.group_id is null and p.document_schema_version=5
    order by c.updated_at desc`,
    { readOnly: true }
  );
}

export async function inviteStudioCollaborators(
  actor: string,
  projectId: string,
  userIds: string[]
) {
  const uniqueIds = [...new Set(userIds)];
  const { project, invitedIds } = await studioTransaction(async sql => {
    const project = await ownerProject(sql, actor, projectId);
    if (uniqueIds.includes(actor)) throw new StudioError('You cannot invite yourself');
    await assertProjectAiSourceSharing(projectId, uniqueIds, 'private', sql);
    const invitedIds: string[] = [];
    for (const userId of uniqueIds) {
      const [user] = await sql`select id from "user" where id=${userId}`;
      if (!user) throw new StudioError('Selected user does not exist', 404);
      const [current] = await sql`
        select id,status from studio_project_collaborator
        where project_id=${projectId} and user_id=${userId} for update`;
      if (current?.status === 'active') continue;
      const now = Date.now();
      if (current) {
        await sql`update studio_project_collaborator
          set status='invited',invited_by_id=${actor},updated_at=${now}
          where id=${current.id}`;
      } else {
        await sql`insert into studio_project_collaborator
          (id,project_id,user_id,invited_by_id,status,created_at,updated_at)
          values(${crypto.randomUUID()},${projectId},${userId},${actor},'invited',${now},${now})`;
      }
      invitedIds.push(userId);
    }
    return { project, invitedIds };
  });
  for (const userId of invitedIds) {
    await createNotification({
      senderId: actor,
      recipientUserId: userId,
      type: 'studio_collaboration_invite',
      title: translate('features.studio.invitationNotificationTitle'),
      message: translate('features.studio.invitationNotificationMessage', {
        projectTitle: project.title,
      }),
      actionUrl: '/studio',
      relatedEntityType: 'studio_project',
    });
  }
  return { invited: invitedIds.length };
}

export async function respondStudioInvitation(
  actor: string,
  invitationId: string,
  accept: boolean
) {
  return studioTransaction(async sql => {
    const [invitation] = await sql`
      select c.id,c.status,c.user_id,c.project_id,p.group_id,p.kind
      from studio_project_collaborator c join studio_project p on p.id=c.project_id
      where c.id=${invitationId} for update`;
    if (
      !invitation ||
      invitation.user_id !== actor ||
      invitation.status !== 'invited' ||
      invitation.group_id
    )
      throw new StudioError('Studio invitation is no longer available', 403);
    if (accept) await assertProjectAiSourceSharing(invitation.project_id, [actor], 'private', sql);
    await sql`update studio_project_collaborator
      set status=${accept ? 'active' : 'declined'},updated_at=${Date.now()}
      where id=${invitationId}`;
    return { status: accept ? 'active' : 'declined' };
  });
}

export async function removeStudioCollaborator(actor: string, projectId: string, userId: string) {
  return studioTransaction(async sql => {
    await ownerProject(sql, actor, projectId);
    await sql`delete from studio_project_collaborator
      where project_id=${projectId} and user_id=${userId}`;
    return { ok: true };
  });
}
