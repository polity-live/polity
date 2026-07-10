import { json, number, string, table, type ReadonlyJSONValue } from '@rocicorp/zero';

export const dataset = table('dataset')
  .columns({
    id: string(),
    provider: string(),
    provider_dataset_id: string().optional(),
    provider_resource_id: string().optional(),
    title: string(),
    description: string().optional(),
    license: string().optional(),
    publisher: string().optional(),
    language: string(),
    source_url: string().optional(),
    structure_summary: string().optional(),
    dimensions: json<ReadonlyJSONValue>(),
    columns: json<ReadonlyJSONValue>(),
    column_profiles: json<ReadonlyJSONValue>(),
    time_coverage: json<ReadonlyJSONValue>(),
    spatial_coverage: json<ReadonlyJSONValue>(),
    topics: json<ReadonlyJSONValue>(),
    metadata: json<ReadonlyJSONValue>(),
    visibility: string(),
    owner_user_id: string().optional(),
    group_id: string().optional(),
    status: string(),
    created_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const datasetSnapshot = table('dataset_snapshot')
  .columns({
    id: string(),
    dataset_id: string(),
    snapshot_key: string(),
    storage_bucket: string(),
    storage_path: string(),
    format: string(),
    content_hash: string(),
    byte_size: number(),
    row_count: number(),
    column_count: number(),
    columns: json<ReadonlyJSONValue>(),
    column_profiles: json<ReadonlyJSONValue>(),
    dimensions: json<ReadonlyJSONValue>(),
    metadata: json<ReadonlyJSONValue>(),
    status: string(),
    snapshot_taken_at: number(),
    created_by_id: string().optional(),
    error: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
