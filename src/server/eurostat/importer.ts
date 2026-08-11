import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';
import {
  MAX_EUROSTAT_DATASET_BYTES,
  type EurostatDatasetDetails,
  type EurostatImportProgress,
} from '@/features/charts/types';
import { EUROSTAT_BASE_URL } from './constants';
import { createStableHash } from './hash';
import { createEurostatDataUrl } from './metadata';
import { buildEurostatPartitions } from './partition';
import { eurostatSql as sql } from './db';
import { readEurostatCsvResponse } from './response';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
});

interface DatasetRow {
  id: string;
  status: EurostatImportProgress['status'];
  partition_count: number;
  completed_partitions: number;
  observation_count: number;
  estimated_bytes: number;
  actual_bytes: number;
  error: string | null;
}

interface PartitionRow {
  id: string;
  dataset_id: string;
  filters: Record<string, string[]>;
  status: string;
  async_request_id: string | null;
}

function toProgress(row: DatasetRow): EurostatImportProgress {
  return {
    datasetId: row.id,
    status: row.status,
    partitionCount: Number(row.partition_count),
    completedPartitions: Number(row.completed_partitions),
    observationCount: Number(row.observation_count),
    estimatedBytes: Number(row.estimated_bytes),
    actualBytes: Number(row.actual_bytes),
    error: row.error,
  };
}

export async function createOrResumeEurostatImport(
  details: EurostatDatasetDetails,
  userId: string
) {
  const datasetId = randomUUID();
  const status = details.importAllowed ? 'pending' : 'blocked';
  const error = details.importAllowed ? null : 'Estimated dataset size exceeds 100 MB';

  const inserted = await sql<DatasetRow[]>`
    INSERT INTO eurostat_dataset (
      id, code, title, language, snapshot_key, source_last_update,
      structure_last_change, data_start, data_end, source_value_count,
      estimated_bytes, dimensions, attributes, status, error, created_by_id
    )
    VALUES (
      ${datasetId}, ${details.code}, ${details.title}, ${details.language},
      ${details.snapshotKey}, ${details.lastUpdate}, ${details.structureLastChange},
      ${details.dataStart}, ${details.dataEnd}, ${details.valueCount},
      ${details.estimatedBytes}, ${sql.json(JSON.parse(JSON.stringify(details.dimensions)))},
      ${sql.json(details.attributes)},
      ${status}, ${error}, ${userId}
    )
    ON CONFLICT (snapshot_key) DO NOTHING
    RETURNING *
  `;

  let dataset = inserted[0];
  if (!dataset) {
    const existing = await sql<DatasetRow[]>`
      SELECT * FROM eurostat_dataset WHERE snapshot_key = ${details.snapshotKey} LIMIT 1
    `;
    dataset = existing[0];
  }
  if (!dataset) {
    throw new Error('Failed to create Eurostat snapshot');
  }

  if (inserted.length === 0 && dataset.status === 'error' && details.importAllowed) {
    await sql`
      UPDATE eurostat_import_partition
      SET status = 'pending', error = NULL, updated_at = now()
      WHERE dataset_id = ${dataset.id} AND status = 'error'
    `;
    const resumed = await sql<DatasetRow[]>`
      UPDATE eurostat_dataset
      SET status = 'importing', error = NULL, updated_at = now()
      WHERE id = ${dataset.id}
      RETURNING *
    `;
    dataset = resumed[0] ?? dataset;
  }

  if (inserted.length > 0 && details.importAllowed) {
    const partitions = buildEurostatPartitions(details.dimensions);
    if (partitions.length === 0) {
      await sql`
        UPDATE eurostat_dataset
        SET status = 'error', error = 'Dataset has no importable dimensions', updated_at = now()
        WHERE id = ${dataset.id}
      `;
    } else {
      const rows = partitions.map(partition => ({
        id: createStableHash({
          datasetId: dataset.id,
          index: partition.index,
          filters: partition.filters,
        }),
        dataset_id: dataset.id,
        partition_index: partition.index,
        filters: sql.json(partition.filters),
        estimated_cells: partition.estimatedCells,
      }));
      await sql`
        INSERT INTO eurostat_import_partition ${sql(
          rows,
          'id',
          'dataset_id',
          'partition_index',
          'filters',
          'estimated_cells'
        )}
        ON CONFLICT (dataset_id, partition_index) DO NOTHING
      `;
      const updated = await sql<DatasetRow[]>`
        UPDATE eurostat_dataset
        SET partition_count = ${partitions.length}, status = 'importing', updated_at = now()
        WHERE id = ${dataset.id}
        RETURNING *
      `;
      dataset = updated[0] ?? dataset;
    }
  }

  return toProgress(dataset);
}

async function claimNextPartition(datasetId: string) {
  const rows = await sql<PartitionRow[]>`
    UPDATE eurostat_import_partition
    SET status = 'processing', attempts = attempts + 1, updated_at = now()
    WHERE id = (
      SELECT id
      FROM eurostat_import_partition
      WHERE dataset_id = ${datasetId}
        AND (
          status = 'pending'
          OR (status = 'processing' AND async_request_id IS NOT NULL)
          OR (status = 'processing' AND updated_at < now() - interval '5 minutes')
        )
      ORDER BY partition_index
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  return rows[0] ?? null;
}

function findNestedValue(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  if (key in value) {
    const nested = (value as Record<string, unknown>)[key];
    if (typeof nested === 'string') return nested;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findNestedValue(nested, key);
    if (found) return found;
  }
  return null;
}

async function resolvePartitionResponse(partition: PartitionRow, code: string) {
  if (partition.async_request_id) {
    const statusResponse = await fetch(
      `${EUROSTAT_BASE_URL}/1.0/async/status/${encodeURIComponent(partition.async_request_id)}`
    );
    const statusText = await statusResponse.text();
    const status = findNestedValue(xmlParser.parse(statusText), 'status');
    if (status !== 'AVAILABLE') {
      if (status === 'ERROR' || status === 'EXPIRED' || status === 'UNKNOWN_REQUEST') {
        throw new Error(`Eurostat async request ended with ${status}`);
      }
      return null;
    }
    return fetch(
      `${EUROSTAT_BASE_URL}/1.0/async/data/${encodeURIComponent(partition.async_request_id)}`
    );
  }

  const response = await fetch(createEurostatDataUrl(code, partition.filters), {
    headers: {
      Accept: 'application/vnd.sdmx.data+csv;version=2.0.0;labels=id',
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('xml')) {
    const text = await response.text();
    const parsed = xmlParser.parse(text);
    const asyncRequestId = findNestedValue(parsed, 'id');
    const status = findNestedValue(parsed, 'status');
    if (asyncRequestId && (status === 'SUBMITTED' || status === 'PROCESSING')) {
      await sql`
        UPDATE eurostat_import_partition
        SET async_request_id = ${asyncRequestId}, status = 'processing', updated_at = now()
        WHERE id = ${partition.id}
      `;
      return null;
    }
    throw new Error(findNestedValue(parsed, 'faultstring') ?? 'Eurostat returned XML');
  }
  return response;
}

function parseObservations(csvText: string, datasetId: string, dimensionIds: readonly string[]) {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const dimensionsSet = new Set(dimensionIds);
  const ignored = new Set(['STRUCTURE', 'STRUCTURE_ID', 'DATAFLOW', 'LAST UPDATE', 'OBS_VALUE']);

  return records.flatMap(record => {
    const value = Number(record.OBS_VALUE);
    if (!Number.isFinite(value)) {
      return [];
    }
    const dimensions = Object.fromEntries(
      Object.entries(record)
        .filter(([key]) => dimensionsSet.has(key))
        .map(([key, nested]) => [key, nested])
    );
    const attributes = Object.fromEntries(
      Object.entries(record).filter(
        ([key, nested]) => !ignored.has(key) && !dimensionsSet.has(key) && nested !== ''
      )
    );
    const observationKey = dimensionIds.map(id => `${id}=${dimensions[id] ?? ''}`).join('|');
    return [
      {
        id: createStableHash({ datasetId, observationKey }),
        dataset_id: datasetId,
        observation_key: observationKey,
        time_period: dimensions.TIME_PERIOD ?? null,
        value,
        dimensions: sql.json(dimensions),
        attributes: sql.json(attributes),
        sort_key: `${dimensions.TIME_PERIOD ?? ''}|${observationKey}`,
      },
    ];
  });
}

async function readDataset(datasetId: string) {
  const rows = await sql<(DatasetRow & { code: string; dimensions: any })[]>`
    SELECT * FROM eurostat_dataset WHERE id = ${datasetId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function processEurostatImportStep(datasetId: string) {
  const dataset = await readDataset(datasetId);
  if (!dataset) {
    throw new Error('Eurostat snapshot not found');
  }
  if (dataset.status === 'ready' || dataset.status === 'blocked' || dataset.status === 'error') {
    return toProgress(dataset);
  }

  const partition = await claimNextPartition(datasetId);
  if (!partition) {
    const remaining = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM eurostat_import_partition
      WHERE dataset_id = ${datasetId} AND status <> 'complete'
    `;
    if ((remaining[0]?.count ?? 0) === 0) {
      const ready = await sql<DatasetRow[]>`
        UPDATE eurostat_dataset
        SET status = 'ready', completed_partitions = partition_count, updated_at = now()
        WHERE id = ${datasetId}
        RETURNING *
      `;
      return toProgress(ready[0] ?? dataset);
    }
    return toProgress(dataset);
  }

  try {
    const response = await resolvePartitionResponse(partition, dataset.code);
    if (!response) {
      return toProgress((await readDataset(datasetId)) ?? dataset);
    }
    if (!response.ok) {
      throw new Error(`Eurostat data request failed with ${response.status}`);
    }

    const csvText = await readEurostatCsvResponse(response);
    const dimensionIds = (Array.isArray(dataset.dimensions) ? dataset.dimensions : []).map(
      (dimension: { id: string }) => dimension.id
    );
    const observations = parseObservations(csvText, datasetId, dimensionIds);
    const batchBytes = new TextEncoder().encode(csvText).byteLength + observations.length * 128;

    await sql.begin(async transaction => {
      const latestRows = await transaction<DatasetRow[]>`
        SELECT * FROM eurostat_dataset WHERE id = ${datasetId} FOR UPDATE
      `;
      const latest = latestRows[0];
      if (!latest) throw new Error('Eurostat snapshot disappeared');

      if (Number(latest.actual_bytes) + batchBytes >= MAX_EUROSTAT_DATASET_BYTES) {
        await transaction`DELETE FROM eurostat_observation WHERE dataset_id = ${datasetId}`;
        await transaction`
          UPDATE eurostat_import_partition
          SET status = 'error', error = 'Measured dataset size exceeds 100 MB', updated_at = now()
          WHERE dataset_id = ${datasetId}
        `;
        await transaction`
          UPDATE eurostat_dataset
          SET status = 'blocked', actual_bytes = ${Number(latest.actual_bytes) + batchBytes},
              observation_count = 0, error = 'Measured dataset size exceeds 100 MB',
              updated_at = now()
          WHERE id = ${datasetId}
        `;
        return;
      }

      for (let offset = 0; offset < observations.length; offset += 1000) {
        const batch = observations.slice(offset, offset + 1000);
        await transaction`
          INSERT INTO eurostat_observation ${transaction(
            batch,
            'id',
            'dataset_id',
            'observation_key',
            'time_period',
            'value',
            'dimensions',
            'attributes',
            'sort_key'
          )}
          ON CONFLICT (dataset_id, observation_key) DO NOTHING
        `;
      }
      await transaction`
        UPDATE eurostat_import_partition
        SET status = 'complete', observation_count = ${observations.length},
            error = NULL, updated_at = now()
        WHERE id = ${partition.id}
      `;
      await transaction`
        UPDATE eurostat_dataset
        SET actual_bytes = actual_bytes + ${batchBytes},
            completed_partitions = completed_partitions + 1,
            observation_count = (
              SELECT count(*) FROM eurostat_observation WHERE dataset_id = ${datasetId}
            ),
            status = CASE
              WHEN completed_partitions + 1 >= partition_count THEN 'ready'
              ELSE 'importing'
            END,
            updated_at = now()
        WHERE id = ${datasetId}
      `;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      UPDATE eurostat_import_partition
      SET status = 'error', error = ${message}, updated_at = now()
      WHERE id = ${partition.id}
    `;
    await sql`
      UPDATE eurostat_dataset
      SET status = 'error', error = ${message}, updated_at = now()
      WHERE id = ${datasetId}
    `;
  }

  const updated = await readDataset(datasetId);
  return toProgress(updated ?? dataset);
}

export const eurostatImporterContracts = {
  toProgress,
  claimNextPartition,
  findNestedValue,
  resolvePartitionResponse,
  parseObservations,
  readDataset,
};
