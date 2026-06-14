import {
  MAX_CHART_POINTS,
  type ChartPoint,
  type EurostatProjectionRequest,
  type EurostatProjectionResult,
} from '@/features/charts/types';
import { createStableHash } from './hash';
import { eurostatSql as sql } from './db';
import { normalizeEurostatValueField, validateProjectionDimensions } from './projection-validation';

interface DatasetRecord {
  id: string;
  status: string;
  dimensions: { id: string }[];
}

export async function createEurostatProjection(
  request: EurostatProjectionRequest,
  userId: string
): Promise<EurostatProjectionResult> {
  const datasetRows = await sql<DatasetRecord[]>`
    SELECT id, status, dimensions
    FROM eurostat_dataset
    WHERE id = ${request.datasetId}
    LIMIT 1
  `;
  const dataset = datasetRows[0];
  if (!dataset || dataset.status !== 'ready') {
    throw new Error('Eurostat snapshot is not ready');
  }

  const dimensionIds = dataset.dimensions.map(dimension => dimension.id);
  validateProjectionDimensions(dimensionIds, request);
  const valueField = normalizeEurostatValueField(request.valueField);
  const normalizedFilters = Object.fromEntries(
    Object.entries(request.filters)
      .filter(([, value]) => value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
  );
  const configHash = createStableHash({
    datasetId: request.datasetId,
    filters: normalizedFilters,
    xDimension: request.xDimension,
    seriesDimension: request.seriesDimension ?? null,
    valueField,
  });
  const projectionId = `projection_${configHash}`;

  const existing = await sql<{ id: string; status: string }[]>`
    SELECT id, status FROM chart_projection WHERE config_hash = ${configHash} LIMIT 1
  `;
  if (existing[0]?.status === 'ready') {
    const pointRows = await sql<{ x_value: string; series_value: string | null; value: number }[]>`
      SELECT x_value, series_value, value
      FROM chart_projection_point
      WHERE projection_id = ${existing[0].id}
      ORDER BY sort_index
    `;
    return {
      projectionId: existing[0].id,
      points: pointRows.map(row => ({
        x: row.x_value,
        series: row.series_value,
        value: Number(row.value),
      })),
    };
  }

  await sql`
    INSERT INTO chart_projection (
      id, dataset_id, config_hash, filters, x_dimension, series_dimension,
      value_field, status, created_by_id
    )
    VALUES (
      ${projectionId}, ${request.datasetId}, ${configHash}, ${sql.json(normalizedFilters)},
      ${request.xDimension}, ${request.seriesDimension ?? null}, ${valueField},
      'pending', ${userId}
    )
    ON CONFLICT (config_hash) DO UPDATE
    SET status = 'pending', error = NULL, updated_at = now()
  `;

  try {
    const rows = await sql<
      { dimensions: Record<string, string>; value: number; sort_key: string }[]
    >`
      SELECT dimensions, value, sort_key
      FROM eurostat_observation
      WHERE dataset_id = ${request.datasetId}
        AND dimensions @> ${sql.json(normalizedFilters)}
      ORDER BY sort_key
      LIMIT ${MAX_CHART_POINTS + 1}
    `;
    if (rows.length > MAX_CHART_POINTS) {
      throw new Error(`Projection exceeds ${MAX_CHART_POINTS} chart points`);
    }

    const points: ChartPoint[] = [];
    const keys = new Set<string>();
    for (const row of rows) {
      const x = String(row.dimensions[request.xDimension] ?? '');
      const series = request.seriesDimension
        ? String(row.dimensions[request.seriesDimension] ?? '')
        : '';
      if (!x) continue;
      const key = `${x}\u0000${series}`;
      if (keys.has(key)) {
        throw new Error('Projection contains duplicate X/series points');
      }
      keys.add(key);
      points.push({ x, series: series || null, value: Number(row.value) });
    }
    if (points.length === 0) {
      throw new Error('Projection contains no observations');
    }

    const pointRows = points.map((point, sortIndex) => ({
      id: createStableHash({ projectionId, point, sortIndex }),
      projection_id: projectionId,
      x_value: point.x,
      series_value: point.series ?? null,
      value: point.value,
      sort_index: sortIndex,
    }));

    await sql.begin(async transaction => {
      await transaction`
        DELETE FROM chart_projection_point WHERE projection_id = ${projectionId}
      `;
      for (let offset = 0; offset < pointRows.length; offset += 1000) {
        const batch = pointRows.slice(offset, offset + 1000);
        await transaction`
          INSERT INTO chart_projection_point ${transaction(
            batch,
            'id',
            'projection_id',
            'x_value',
            'series_value',
            'value',
            'sort_index'
          )}
        `;
      }
      await transaction`
        UPDATE chart_projection
        SET status = 'ready', point_count = ${points.length}, error = NULL, updated_at = now()
        WHERE id = ${projectionId}
      `;
    });

    return { projectionId, points };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      UPDATE chart_projection
      SET status = 'error', error = ${message}, updated_at = now()
      WHERE id = ${projectionId}
    `;
    throw error;
  }
}
