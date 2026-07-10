import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

export const datasetQueries = {
  datasetById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.dataset.where('id', id).one()
  ),

  snapshotById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.dataset_snapshot.where('id', id).one()
  ),

  latestSnapshotByDatasetId: defineQuery(
    z.object({ datasetId: z.string() }),
    ({ args: { datasetId } }) =>
      zql.dataset_snapshot
        .where('dataset_id', datasetId)
        .where('status', 'ready')
        .orderBy('snapshot_taken_at', 'desc')
        .one()
  ),

  snapshotsByDatasetId: defineQuery(
    z.object({ datasetId: z.string(), limit: z.number().int().min(1).max(50).default(10) }),
    ({ args: { datasetId, limit } }) =>
      zql.dataset_snapshot
        .where('dataset_id', datasetId)
        .orderBy('snapshot_taken_at', 'desc')
        .limit(limit)
  ),

  groupDatasets: defineQuery(
    z.object({ groupId: z.string(), limit: z.number().int().min(1).max(200).default(50) }),
    ({ args: { groupId, limit } }) =>
      zql.dataset
        .where('group_id', groupId)
        .where('status', 'active')
        .related('snapshots', q => q.orderBy('snapshot_taken_at', 'desc').limit(5))
        .orderBy('updated_at', 'desc')
        .limit(limit)
  ),
};

export type DatasetRow = QueryRowType<typeof datasetQueries.datasetById>;
export type DatasetSnapshotRow = QueryRowType<typeof datasetQueries.snapshotById>;
export type GroupDatasetRow = QueryRowType<typeof datasetQueries.groupDatasets>;
