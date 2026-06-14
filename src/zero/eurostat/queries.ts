import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

export const eurostatQueries = {
  datasetById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.eurostat_dataset.where('id', id).one()
  ),

  latestDatasetByCode: defineQuery(z.object({ code: z.string() }), ({ args: { code } }) =>
    zql.eurostat_dataset
      .where('code', code.toUpperCase())
      .where('status', 'ready')
      .orderBy('created_at', 'desc')
      .one()
  ),

  observationPreview: defineQuery(
    z.object({ datasetId: z.string(), limit: z.number().int().min(1).max(100).default(25) }),
    ({ args: { datasetId, limit } }) =>
      zql.eurostat_observation
        .where('dataset_id', datasetId)
        .orderBy('sort_key', 'asc')
        .limit(limit)
  ),

  projectionById: defineQuery(z.object({ id: z.string() }), ({ args: { id } }) =>
    zql.chart_projection.where('id', id).one()
  ),

  projectionPoints: defineQuery(
    z.object({ projectionId: z.string(), limit: z.number().int().min(1).max(5000).default(2000) }),
    ({ args: { projectionId, limit } }) =>
      zql.chart_projection_point
        .where('projection_id', projectionId)
        .orderBy('sort_index', 'asc')
        .limit(limit)
  ),
};

export type EurostatDatasetRow = QueryRowType<typeof eurostatQueries.datasetById>;
export type EurostatObservationPreviewRow = QueryRowType<typeof eurostatQueries.observationPreview>;
export type ChartProjectionRow = QueryRowType<typeof eurostatQueries.projectionById>;
export type ChartProjectionPointRow = QueryRowType<typeof eurostatQueries.projectionPoints>;
