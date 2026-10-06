import { studioDocumentV5Schema } from '@/features/communication-studio/logic/document-v3';
import { studioSql, StudioError } from './db';
import { z } from 'zod';

export interface StudioSourceQuery {
  query: (query: string, args: unknown[]) => Promise<unknown>;
}

interface SourceProjectRow {
  group_id: string | null;
  document: unknown;
  content_revision: number;
  generation: string;
  phase: string;
  can_read: boolean;
  can_suggest: boolean;
  shared: boolean;
}
interface SourceProposalRow {
  title: string;
  document: unknown;
  base_document: unknown;
  revision: number;
  owner_id: string;
  origin: string;
  state: string;
  ai_status: string;
  ai_mode: string;
  ai_sources: unknown;
  can_read: boolean;
}

/** The same source is used by reads, media, target resolution and suggestions. */
export async function resolveStudioSource(
  actor: string,
  projectId: string,
  workspaceId: string | null = null,
  query?: StudioSourceQuery
) {
  const uuid = z
    .string()
    .uuid()
    .refine(id => id !== '00000000-0000-0000-0000-000000000000');
  if (
    ![actor, projectId, ...(workspaceId ? [workspaceId] : [])].every(
      id => uuid.safeParse(id).success
    )
  )
    throw new StudioError('Invalid Studio workspace reference.', 400, 'ai_workspace_invalid');
  const db = query ?? {
    query: (text: string, args: unknown[]) => studioSql().unsafe(text, args as never[]),
  };
  const [project] = (await db.query(
    `select p.group_id,s.document,s.content_revision,c.generation,c.phase,
    studio_collaboration_access($1::uuid,p.id) as can_read,
    canvas_capability($1::uuid,p.id,'suggest') as can_suggest,
    exists(select 1 from studio_project_collaborator where project_id=p.id and status='active') as shared
    from studio_project p join studio_state s on s.project_id=p.id
    join canvas_control c on c.project_id=p.id where p.id=$2`,
    [actor, projectId]
  )) as SourceProjectRow[];
  if (!project?.can_read)
    throw new StudioError('Studio project is unavailable.', 404, 'ai_workspace_unavailable');
  const canonical = studioDocumentV5Schema.parse(project.document);
  let proposal: SourceProposalRow | undefined;
  if (workspaceId) {
    [proposal] = (await db.query(
      `select *,canvas_proposal_access($1::uuid,id) as can_read
      from canvas_proposal where id=$2 and project_id=$3`,
      [actor, workspaceId, projectId]
    )) as SourceProposalRow[];
    if (!proposal?.can_read)
      throw new StudioError(
        'Selected Studio workspace is unavailable.',
        404,
        'ai_workspace_unavailable'
      );
  }
  const document = proposal ? studioDocumentV5Schema.parse(proposal.document) : canonical;
  return {
    projectId,
    workspaceId,
    canonical,
    document,
    proposal,
    groupId: project.group_id,
    contentRevision: Number(project.content_revision),
    generation: project.generation,
    revision: `${project.generation}:${project.content_revision}:${workspaceId ?? 'canonical'}:${proposal?.revision ?? 0}`,
    canSuggest: !!project.can_suggest && ['edit', 'suggest_internal'].includes(project.phase),
    audienceIsShared: !!project.group_id || !!project.shared,
  };
}
