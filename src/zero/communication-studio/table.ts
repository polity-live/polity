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
