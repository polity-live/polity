import type postgres from 'postgres';
import { assertStudioAccess, StudioError } from './db';
export async function assertCanvasWorkspace(
  actor: string,
  projectId: string,
  workspaceId: string | undefined,
  edit: boolean,
  sql: postgres.Sql | postgres.TransactionSql
) {
  if (!workspaceId) return assertStudioAccess(actor, projectId, edit, sql);
  const [p] =
    await sql`select p.*,canvas_proposal_access(${actor}::uuid,p.id) as can_read,canvas_capability(${actor}::uuid,p.project_id,'suggest') as can_suggest,c.phase from canvas_proposal p join canvas_control c on c.project_id=p.project_id where p.id=${workspaceId} and p.project_id=${projectId}`;
  if (
    !p?.can_read ||
    (edit &&
      (!p.can_suggest ||
        p.state !== 'draft' ||
        !(
          ['edit', 'suggest_internal'].includes(p.phase) ||
          (p.phase === 'vote_internal' && p.resolves_id)
        ) ||
        (p.owner_id !== actor && !p.shared_ids.includes(actor))))
  )
    throw new StudioError('No access to this proposal workspace', 403);
}
