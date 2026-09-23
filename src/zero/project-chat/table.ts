import type { MutableJSONValue } from '../shared/helpers';
import { table, string, number, json } from '@rocicorp/zero';

// Provider messages, tool inputs and inverse snapshots are server-only columns.
export const aiRun = table('ai_run')
  .columns({
    id: string(),
    conversation_id: string(),
    actor_id: string(),
    request_id: string(),
    status: string(),
    partial_text: string(),
    streaming_text: string(),
    model: json<MutableJSONValue>(),
    editor_context: json<MutableJSONValue>(),
    error_code: string().optional(),
    lease_expires_at: number(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
export const aiChangeSet = table('ai_change_set')
  .columns({
    id: string(),
    conversation_id: string(),
    run_id: string(),
    actor_id: string(),
    resource_kind: string(),
    resource_id: string(),
    branch_id: string().optional(),
    summary: string(),
    status: string(),
    created_at: number(),
    undone_at: number().optional(),
  })
  .primaryKey('id');
