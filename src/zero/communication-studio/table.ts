import { table, string, number, boolean, json } from '@rocicorp/zero';
export const studioProject = table('studio_project')
  .columns({
    id: string(),
    owner_id: string(),
    group_id: string().optional(),
    title: string(),
    kind: string(),
    is_template: boolean(),
    version: number(),
    document_schema_version: number(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
export const studioProjectCollaborator = table('studio_project_collaborator')
  .columns({
    id: string(),
    project_id: string(),
    user_id: string(),
    invited_by_id: string(),
    status: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
export const studioExport = table('studio_export')
  .columns({
    id: string(),
    project_id: string(),
    revision_id: string(),
    requested_by_id: string(),
    format: string(),
    page_ids: json<string[]>(),
    status: string(),
    progress: number(),
    attempts: number(),
    lease_at: number().optional(),
    error: string().optional(),
    storage_path: string().optional(),
    file_name: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const studioState = table('studio_state')
  .columns({
    project_id: string(),
    document: json<any>(),
    content_revision: number(),
    updated_at: number(),
  })
  .primaryKey('project_id');

export const studioOperation = table('studio_operation')
  .columns({
    id: string(),
    project_id: string(),
    actor_id: string(),
    result: json(),
    created_at: number(),
  })
  .primaryKey('id');

export const canvasProposal = table('canvas_proposal')
  .columns({
    id: string(),
    project_id: string(),
    owner_id: string(),
    title: string(),
    reason: string(),
    state: string(),
    checksum: string().optional(),
    document: json<any>(),
    revision: number(),
    updated_at: number(),
  })
  .primaryKey('id');
export const canvasWorkspaceReader = table('canvas_workspace_reader')
  .columns({ workspace_id: string(), user_id: string() })
  .primaryKey('workspace_id', 'user_id');
