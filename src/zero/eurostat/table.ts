import { json, number, string, table, type ReadonlyJSONValue } from '@rocicorp/zero';

export const eurostatDataset = table('eurostat_dataset')
  .columns({
    id: string(),
    code: string(),
    title: string(),
    language: string(),
    snapshot_key: string(),
    source_last_update: string().optional(),
    structure_last_change: string().optional(),
    data_start: string().optional(),
    data_end: string().optional(),
    source_value_count: number(),
    observation_count: number(),
    estimated_bytes: number(),
    actual_bytes: number(),
    dimensions: json<ReadonlyJSONValue>(),
    attributes: json<ReadonlyJSONValue>(),
    status: string(),
    partition_count: number(),
    completed_partitions: number(),
    error: string().optional(),
    created_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const eurostatObservation = table('eurostat_observation')
  .columns({
    id: string(),
    dataset_id: string(),
    observation_key: string(),
    time_period: string().optional(),
    value: number(),
    dimensions: json<ReadonlyJSONValue>(),
    attributes: json<ReadonlyJSONValue>(),
    sort_key: string(),
    created_at: number(),
  })
  .primaryKey('id');

export const chartProjection = table('chart_projection')
  .columns({
    id: string(),
    dataset_id: string(),
    config_hash: string(),
    filters: json<ReadonlyJSONValue>(),
    x_dimension: string(),
    series_dimension: string().optional(),
    value_field: string(),
    status: string(),
    point_count: number(),
    error: string().optional(),
    created_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const chartProjectionPoint = table('chart_projection_point')
  .columns({
    id: string(),
    projection_id: string(),
    x_value: string(),
    series_value: string().optional(),
    value: number(),
    sort_index: number(),
    created_at: number(),
  })
  .primaryKey('id');
