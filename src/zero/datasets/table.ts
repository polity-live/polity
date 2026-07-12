import { json, number, string, table } from '@rocicorp/zero';
import type { MutableJSONValue } from '../shared/helpers';

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
    dimensions: json<MutableJSONValue>(),
    columns: json<MutableJSONValue>(),
    column_profiles: json<MutableJSONValue>(),
    time_coverage: json<MutableJSONValue>(),
    spatial_coverage: json<MutableJSONValue>(),
    topics: json<MutableJSONValue>(),
    metadata: json<MutableJSONValue>(),
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
    columns: json<MutableJSONValue>(),
    column_profiles: json<MutableJSONValue>(),
    dimensions: json<MutableJSONValue>(),
    metadata: json<MutableJSONValue>(),
    status: string(),
    snapshot_taken_at: number(),
    created_by_id: string().optional(),
    error: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
