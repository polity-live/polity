import { table, string, number, boolean, json } from '@rocicorp/zero';
export const studioProject = table('studio_project')
  .columns({
    id: string(),
    owner_id: string(),
    group_id: string().optional(),
    title: string(),
    kind: string(),
    visibility: string(),
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
    base_document: json(),
    base_revision: number(),
    base_generation: string(),
    changes: json().optional(),
    decision: string().optional(),
    application: string(),
    conflicts: json(),
    electorate: json().optional(),
    deadline: number().optional(),
    resolves_id: string().optional(),
    origin: string(),
    ai_mode: string().optional(),
    ai_status: string(),
    ai_sources: json(),
    ai_warnings: json(),
    created_at: number(),

    updated_at: number(),
  })
  .primaryKey('id');
export const canvasWorkspaceReader = table('canvas_workspace_reader')
  .columns({ workspace_id: string(), user_id: string() })
  .primaryKey('workspace_id', 'user_id');

export const studioCommandReceipt = table('studio_command_receipt')
  .columns({
    id: string(),
    actor_id: string(),
    project_id: string().optional(),
    command: string(),
    result: json(),
    created_at: number(),
    expires_at: number().optional(),
  })
  .primaryKey('id');

export const studioAsset = table('studio_asset')
  .columns({
    id: string(),
    project_id: string(),
    workspace_id: string().optional(),
    name: string(),
    mime_type: string(),
    byte_size: number(),
    ready: boolean(),
    created_at: number(),
  })
  .primaryKey('id');

export const studioRevision = table('studio_revision')
  .columns({
    id: string(),
    project_id: string(),
    document: json(),
    content_revision: number(),
    created_at: number(),
  })
  .primaryKey('id');

export const canvasControl = table('canvas_control')
  .columns({
    project_id: string(),
    phase: string(),
    generation: string(),
  })
  .primaryKey('project_id');

export const canvasVote = table('canvas_vote')
  .columns({
    proposal_id: string(),
    user_id: string(),
    choice: string(),
    created_at: number(),
  })
  .primaryKey('proposal_id', 'user_id');

export const canvasComment = table('canvas_comment')
  .columns({
    id: string(),
    project_id: string(),
    proposal_id: string().optional(),
    author_id: string(),
    element_id: string().optional(),
    body: string(),
    resolved: boolean(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const canvasHistory = table('canvas_history')
  .columns({
    id: string(),
    project_id: string(),
    revision: number(),
    generation: string(),
    document: json(),
    created_at: number(),
  })
  .primaryKey('id');

export const canvasLibrary = table('canvas_library')
  .columns({
    id: string(),
    project_id: string(),
    name: string(),
    content: json(),
    created_by: string(),
    created_at: number(),
  })
  .primaryKey('id');

export const canvasRoleCapability = table('canvas_role_capability')
  .columns({
    role_id: string(),
    capability: string(),
    allowed: boolean(),
  })
  .primaryKey('role_id', 'capability');

export const canvasReceipt = table('canvas_receipt')
  .columns({
    id: string(),
    project_id: string(),
    actor_id: string(),
    result: json(),
    created_at: number(),
  })
  .primaryKey('id');

export const studioEditorAction = table('studio_editor_action')
  .columns({
    pending: boolean(),
    id: string(),
    project_id: string(),
    actor_id: string(),
    name: string(),
    input: json(),
    result: json().optional(),
    claimed_by: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const studioElementSet = table('studio_element_set')
  .columns({
    id: string(),
    owner_id: string().optional(),
    group_id: string().optional(),
    name: string(),
    current_revision_id: string().optional(),
    archived_at: number().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const studioElementSetRevision = table('studio_element_set_revision')
  .columns({
    id: string(),
    set_id: string(),
    version: number(),
    snapshot: json(),
    width: number(),
    height: number(),
    created_at: number(),
  })
  .primaryKey('id');
