import { createHash, randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type {
  DataViewProjection,
  DataViewProjectionRequest,
  DatasetColumnProfile,
  DatasetProviderId,
  DatasetSearchResult,
  DatasetSnapshotImportResult,
} from '@/features/charts/types';
import { normalizeGovDataText } from '@/server/govdata/catalogue';
import {
  aggregateDatasetValues,
  buildDatasetProjectionPoints,
  getDescriptiveStats,
  parseDatasetCsv,
  parseDatasetNumber,
  profileDatasetColumns,
  summarizeDatasetStructure,
  tableToCsv,
  type DatasetTable,
} from './csv';
import { datasetSql as sql } from './db';
import { buildMultiMeasureProjectionPoints } from './projection';
import {
  DATASET_SNAPSHOT_BUCKET,
  createSnapshotStoragePath,
  downloadSnapshotText,
  hashBytes,
  textToBytes,
  uploadSnapshotBytes,
} from './storage';
import {
  assertCanContributeGroupDatasets,
  assertCanManageGroupDatasets,
  assertCanReadDataset,
  userCanReadDataset,
} from './access';

interface DatasetRecord {
  id: string;
  provider: DatasetProviderId;
  provider_dataset_id: string | null;
  provider_resource_id: string | null;
  title: string;
  description: string | null;
  license: string | null;
  publisher: string | null;
  language: string;
  source_url: string | null;
  structure_summary: string | null;
  dimensions: unknown;
  columns: unknown;
  column_profiles: unknown;
  time_coverage: unknown;
  spatial_coverage: unknown;
  topics: unknown;
  metadata: Record<string, unknown>;
  visibility: string;
  owner_user_id: string | null;
  group_id: string | null;
  status: string;
  created_by_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SnapshotRecord {
  id: string;
  dataset_id: string;
  snapshot_key: string;
  storage_bucket: string;
  storage_path: string;
  format: string;
  content_hash: string;
  byte_size: number;
  row_count: number;
  column_count: number;
  columns: unknown;
  column_profiles: unknown;
  dimensions: unknown;
  metadata: Record<string, unknown>;
  status: string;
  snapshot_taken_at: Date;
  created_by_id: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PersistDatasetSnapshotInput {
  provider: DatasetProviderId;
  providerDatasetId?: string | null;
  providerResourceId?: string | null;
  title: string;
  description?: string | null;
  license?: string | null;
  publisher?: string | null;
  language?: string | null;
  sourceUrl?: string | null;
  structureSummary?: string | null;
  dimensions?: unknown;
  timeCoverage?: unknown;
  spatialCoverage?: unknown;
  topics?: string[];
  metadata?: Record<string, unknown>;
  visibility?: 'public' | 'authenticated' | 'private';
  ownerUserId?: string | null;
  groupId?: string | null;
  createdById: string;
  table: DatasetTable;
  snapshotTakenAt?: string | Date | null;
}

export interface LegacyDatasetProjectionRequest {
  snapshotId: string;
  mapping: import('@/features/charts/types').ChartMapping;
  filters?: Record<string, string>;
  statsColumn?: string | null;
}

export type DatasetProjectionRequest = DataViewProjectionRequest | LegacyDatasetProjectionRequest;

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function toPostgresJson(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asColumnProfiles(value: unknown): DatasetColumnProfile[] {
  return Array.isArray(value) ? (value as DatasetColumnProfile[]) : [];
}

function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeProviderList(providers: readonly string[]) {
  return providers
    .map(provider => provider.trim().toUpperCase())
    .filter(provider =>
      ['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD'].includes(provider)
    ) as DatasetProviderId[];
}

async function findExistingDataset(input: PersistDatasetSnapshotInput) {
  const rows = await sql<DatasetRecord[]>`
    SELECT *
    FROM dataset
    WHERE provider = ${input.provider}
      AND coalesce(provider_dataset_id, '') = ${input.providerDatasetId ?? ''}
      AND coalesce(provider_resource_id, '') = ${input.providerResourceId ?? ''}
      AND coalesce(group_id::text, '') = ${input.groupId ?? ''}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function upsertDataset(input: PersistDatasetSnapshotInput) {
  const existing = await findExistingDataset(input);
  const columns = input.table.columns;
  const columnProfiles = profileDatasetColumns(input.table);
  const structureSummary = input.structureSummary || summarizeDatasetStructure(input.table);

  if (existing) {
    const rows = await sql<DatasetRecord[]>`
      UPDATE dataset
      SET
        title = ${input.title},
        description = ${input.description ?? null},
        license = ${input.license ?? null},
        publisher = ${input.publisher ?? null},
        language = ${input.language ?? 'en'},
        source_url = ${input.sourceUrl ?? null},
        structure_summary = ${structureSummary},
        dimensions = ${sql.json(toPostgresJson(input.dimensions ?? []))},
        columns = ${sql.json(toPostgresJson(columns))},
        column_profiles = ${sql.json(toPostgresJson(columnProfiles))},
        time_coverage = ${sql.json(toPostgresJson(input.timeCoverage ?? {}))},
        spatial_coverage = ${sql.json(toPostgresJson(input.spatialCoverage ?? {}))},
        topics = ${sql.json(toPostgresJson(input.topics ?? []))},
        metadata = ${sql.json(toPostgresJson(input.metadata ?? {}))},
        visibility = ${input.visibility ?? (input.groupId ? 'private' : 'public')},
        owner_user_id = ${input.ownerUserId ?? input.createdById},
        group_id = ${input.groupId ?? null},
        status = 'active',
        updated_at = now()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    return rows[0] ?? existing;
  }

  const datasetId = randomUUID();
  const rows = await sql<DatasetRecord[]>`
    INSERT INTO dataset (
      id, provider, provider_dataset_id, provider_resource_id, title, description,
      license, publisher, language, source_url, structure_summary, dimensions,
      columns, column_profiles, time_coverage, spatial_coverage, topics, metadata, visibility,
      owner_user_id, group_id, status, created_by_id
    )
    VALUES (
      ${datasetId}, ${input.provider}, ${input.providerDatasetId ?? null},
      ${input.providerResourceId ?? null}, ${input.title}, ${input.description ?? null},
      ${input.license ?? null}, ${input.publisher ?? null}, ${input.language ?? 'en'},
      ${input.sourceUrl ?? null}, ${structureSummary}, ${sql.json(toPostgresJson(input.dimensions ?? []))},
      ${sql.json(toPostgresJson(columns))}, ${sql.json(toPostgresJson(columnProfiles))}, ${sql.json(toPostgresJson(input.timeCoverage ?? {}))},
      ${sql.json(toPostgresJson(input.spatialCoverage ?? {}))}, ${sql.json(toPostgresJson(input.topics ?? []))},
      ${sql.json(toPostgresJson(input.metadata ?? {}))},
      ${input.visibility ?? (input.groupId ? 'private' : 'public')},
      ${input.ownerUserId ?? input.createdById}, ${input.groupId ?? null}, 'active',
      ${input.createdById}
    )
    RETURNING *
  `;
  return rows[0];
}

function toImportResult(
  dataset: DatasetRecord,
  snapshot: SnapshotRecord,
  table: DatasetTable,
  provenance?: Record<string, unknown>
): DatasetSnapshotImportResult {
  return {
    datasetId: dataset.id,
    snapshotId: snapshot.id,
    snapshotKey: snapshot.snapshot_key,
    provider: dataset.provider,
    title: dataset.title,
    publisher: dataset.publisher,
    sourceUrl: dataset.source_url,
    columns: table.columns,
    columnProfiles: asColumnProfiles(snapshot.column_profiles),
    rows: table.rows,
    rowCount: Number(snapshot.row_count),
    columnCount: Number(snapshot.column_count),
    byteSize: Number(snapshot.byte_size),
    snapshotTakenAt: dateToIso(snapshot.snapshot_taken_at) ?? new Date().toISOString(),
    provenance,
  };
}

export async function persistDatasetSnapshot(input: PersistDatasetSnapshotInput) {
  if (input.groupId) {
    await assertCanContributeGroupDatasets(input.createdById, input.groupId);
  }

  const csvText = tableToCsv(input.table);
  const columnProfiles = profileDatasetColumns(input.table);
  const bytes = textToBytes(csvText);
  const contentHash = hashBytes(bytes);
  const snapshotKey = stableHash({
    provider: input.provider,
    providerDatasetId: input.providerDatasetId,
    providerResourceId: input.providerResourceId,
    groupId: input.groupId,
    contentHash,
  });
  const dataset = await upsertDataset(input);
  if (!dataset) throw new Error('Dataset metadata could not be saved');

  const existingSnapshot = await sql<SnapshotRecord[]>`
    SELECT *
    FROM dataset_snapshot
    WHERE snapshot_key = ${snapshotKey}
    LIMIT 1
  `;
  if (existingSnapshot[0]?.status === 'ready') {
    return toImportResult(dataset, existingSnapshot[0], input.table, input.metadata);
  }

  const snapshotId = existingSnapshot[0]?.id ?? randomUUID();
  const storagePath = createSnapshotStoragePath(dataset.id, snapshotId);
  await uploadSnapshotBytes(storagePath, bytes);

  const snapshotRows = await sql<SnapshotRecord[]>`
    INSERT INTO dataset_snapshot (
      id, dataset_id, snapshot_key, storage_bucket, storage_path, format,
      content_hash, byte_size, row_count, column_count, columns, column_profiles, dimensions,
      metadata, status, snapshot_taken_at, created_by_id
    )
    VALUES (
      ${snapshotId}, ${dataset.id}, ${snapshotKey}, ${DATASET_SNAPSHOT_BUCKET},
      ${storagePath}, 'csv', ${contentHash}, ${bytes.byteLength}, ${input.table.rows.length},
      ${input.table.columns.length}, ${sql.json(toPostgresJson(input.table.columns))}, ${sql.json(toPostgresJson(columnProfiles))},
      ${sql.json(toPostgresJson(input.dimensions ?? []))}, ${sql.json(toPostgresJson(input.metadata ?? {}))}, 'ready',
      ${input.snapshotTakenAt ? new Date(input.snapshotTakenAt) : new Date()}, ${input.createdById}
    )
    ON CONFLICT (snapshot_key) DO UPDATE
    SET
      storage_path = EXCLUDED.storage_path,
      content_hash = EXCLUDED.content_hash,
      byte_size = EXCLUDED.byte_size,
      row_count = EXCLUDED.row_count,
      column_count = EXCLUDED.column_count,
      columns = EXCLUDED.columns,
      column_profiles = EXCLUDED.column_profiles,
      dimensions = EXCLUDED.dimensions,
      metadata = EXCLUDED.metadata,
      status = 'ready',
      error = NULL,
      updated_at = now()
    RETURNING *
  `;

  const snapshot = snapshotRows[0];
  if (!snapshot) throw new Error('Dataset snapshot metadata could not be saved');
  return toImportResult(dataset, snapshot, input.table, input.metadata);
}

async function loadSnapshotWithDataset(snapshotId: string) {
  const rows = await sql<(SnapshotRecord & { dataset: DatasetRecord })[]>`
    SELECT
      ds.*,
      to_jsonb(d.*) AS dataset
    FROM dataset_snapshot AS ds
    JOIN dataset AS d ON d.id = ds.dataset_id
    WHERE ds.id = ${snapshotId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function loadDatasetDetails(datasetId: string, userId?: string | null) {
  const datasetRows = await sql<DatasetRecord[]>`
    SELECT *
    FROM dataset
    WHERE id = ${datasetId}
    LIMIT 1
  `;
  const dataset = datasetRows[0];
  if (!dataset) throw new Error('Dataset not found');
  await assertCanReadDataset(userId, dataset);

  const snapshots = await sql<SnapshotRecord[]>`
    SELECT *
    FROM dataset_snapshot
    WHERE dataset_id = ${dataset.id}
    ORDER BY snapshot_taken_at DESC
    LIMIT 10
  `;

  return {
    ...toDatasetSearchResult(dataset, snapshots[0] ?? null),
    dimensions: asArray(dataset.dimensions),
    columns: asArray(dataset.columns),
    columnProfiles: asColumnProfiles(dataset.column_profiles),
    snapshots: snapshots.map(snapshot => ({
      id: snapshot.id,
      snapshotKey: snapshot.snapshot_key,
      status: snapshot.status,
      snapshotTakenAt: dateToIso(snapshot.snapshot_taken_at),
      rowCount: Number(snapshot.row_count),
      columnCount: Number(snapshot.column_count),
      byteSize: Number(snapshot.byte_size),
      error: snapshot.error,
    })),
  };
}

export async function loadSnapshotTable(snapshotId: string, userId?: string | null) {
  const snapshot = await loadSnapshotWithDataset(snapshotId);
  if (!snapshot) throw new Error('Dataset snapshot not found');
  await assertCanReadDataset(userId, snapshot.dataset);
  if (snapshot.status !== 'ready') throw new Error('Dataset snapshot is not ready');

  const text = await downloadSnapshotText(snapshot.storage_path);
  return {
    dataset: snapshot.dataset,
    snapshot,
    table: parseDatasetCsv(text),
  };
}

export async function createDatasetProjection(
  request: DatasetProjectionRequest,
  userId?: string | null
) {
  const { table, snapshot } = await loadSnapshotTable(request.snapshotId, userId);
  const columnSet = new Set(table.columns);
  for (const column of Object.keys(request.filters ?? {})) {
    if (!columnSet.has(column)) throw new Error(`Unknown dataset column: ${column}`);
  }
  const filteredRows = Object.entries(request.filters ?? {}).reduce(
    (rows, [column, value]) =>
      value ? rows.filter(row => String(row[column]) === String(value)) : rows,
    table.rows
  );
  const filteredTable = { ...table, rows: filteredRows };

  if ('mapping' in request) {
    const points = buildDatasetProjectionPoints(filteredTable, request.mapping);
    const stats = request.statsColumn
      ? getDescriptiveStats(filteredTable, request.statsColumn)
      : null;
    return {
      snapshotId: snapshot.id,
      points,
      stats,
      rowCount: filteredTable.rows.length,
      columnCount: filteredTable.columns.length,
    };
  }

  if (request.view === 'table') {
    const requestedColumns = (request.columns ?? table.columns).filter(column =>
      columnSet.has(column)
    );
    const columns = requestedColumns.length > 0 ? requestedColumns : table.columns.slice(0, 6);
    const sortedRows = [...filteredRows];
    if (request.sort?.column && columnSet.has(request.sort.column)) {
      const sort = request.sort;
      const direction = sort.direction === 'desc' ? -1 : 1;
      sortedRows.sort((left, right) => {
        const leftValue = String(left[sort.column]);
        const rightValue = String(right[sort.column]);
        const leftNumber = parseDatasetNumber(leftValue);
        const rightNumber = parseDatasetNumber(rightValue);
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
          return (leftNumber - rightNumber) * direction;
        }
        return leftValue.localeCompare(rightValue, undefined, { numeric: true }) * direction;
      });
    }
    const limit = Math.min(50, Math.max(1, request.limit ?? 10));
    return {
      view: 'table',
      snapshotId: snapshot.id,
      columns,
      rows: sortedRows
        .slice(0, limit)
        .map(row => Object.fromEntries(columns.map(column => [column, String(row[column])]))),
      rowCount: filteredRows.length,
    } satisfies DataViewProjection;
  }

  const measureColumn = request.measureColumn ?? null;
  if (request.aggregation !== 'count' && (!measureColumn || !columnSet.has(measureColumn))) {
    throw new Error('Choose a numeric measure');
  }

  if (request.view === 'stat') {
    const values = filteredRows
      .map(row =>
        request.aggregation === 'count'
          ? 1
          : parseDatasetNumber(String(row[measureColumn as string]))
      )
      .filter(Number.isFinite);
    const value = aggregateDatasetValues(values, request.aggregation);
    if (value == null) throw new Error('No numeric values match the selected filters');
    return {
      view: 'stat',
      snapshotId: snapshot.id,
      label: request.aggregation === 'count' ? 'Count' : (measureColumn as string),
      value,
      aggregation: request.aggregation,
      rowCount: filteredRows.length,
    } satisfies DataViewProjection;
  }

  const dimensionColumn = request.dimensionColumn ?? null;
  if (!dimensionColumn || !columnSet.has(dimensionColumn)) {
    throw new Error('Choose a dimension');
  }
  if (request.seriesColumn && !columnSet.has(request.seriesColumn)) {
    throw new Error('Unknown series column');
  }

  if (request.layout === 'multi') {
    const valueColumns = (request.valueColumns ?? []).filter(column => columnSet.has(column));
    if (valueColumns.length === 0) throw new Error('Choose at least one value column');
    const points = buildMultiMeasureProjectionPoints({
      table: filteredTable,
      dimensionColumn,
      valueColumns,
      aggregation: request.aggregation,
    });
    if (points.length === 0) throw new Error('No values match the selected configuration');
    if (points.length > 5_000) throw new Error('The selected view contains too many points');
    return {
      view: 'chart',
      snapshotId: snapshot.id,
      points,
      rowCount: filteredRows.length,
    } satisfies DataViewProjection;
  }

  const groups = new Map<string, { x: string; series: string; values: number[] }>();
  if (request.layout === 'wide') {
    const valueColumns = (request.valueColumns ?? []).filter(column => columnSet.has(column));
    if (valueColumns.length === 0) throw new Error('Choose at least one value column');
    for (const row of filteredRows) {
      const rowLabel = String(row[dimensionColumn]).trim();
      if (!rowLabel) continue;
      for (const valueColumn of valueColumns) {
        const value = parseDatasetNumber(String(row[valueColumn]));
        if (!Number.isFinite(value)) continue;
        const key = `${valueColumn}\u0000${rowLabel}`;
        const group = groups.get(key) ?? { x: valueColumn, series: rowLabel, values: [] };
        group.values.push(value);
        groups.set(key, group);
      }
    }
  } else {
    for (const row of filteredRows) {
      const x = String(row[dimensionColumn]).trim();
      if (!x) continue;
      const series = request.seriesColumn ? String(row[request.seriesColumn]).trim() : '';
      const value =
        request.aggregation === 'count'
          ? 1
          : parseDatasetNumber(String(row[measureColumn as string]));
      if (!Number.isFinite(value)) continue;
      const key = `${x}\u0000${series}`;
      const group = groups.get(key) ?? { x, series, values: [] };
      group.values.push(value);
      groups.set(key, group);
    }
  }
  const points = [...groups.values()].map(group => {
    const value = aggregateDatasetValues(group.values, request.aggregation);
    return { x: group.x, value: value as number, series: group.series || null };
  });
  if (points.length === 0) throw new Error('No values match the selected configuration');

  return {
    view: 'chart',
    snapshotId: snapshot.id,
    points,
    rowCount: filteredRows.length,
  } satisfies DataViewProjection;
}

export async function getDatasetColumnValues({
  snapshotId,
  column,
  query = '',
  limit = 50,
  userId,
}: {
  snapshotId: string;
  column: string;
  query?: string;
  limit?: number;
  userId?: string | null;
}) {
  const { table } = await loadSnapshotTable(snapshotId, userId);
  if (!table.columns.includes(column)) throw new Error('Dataset column not found');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const values = new Set<string>();

  for (const row of table.rows) {
    const value = String(row[column]).trim();
    if (!value || (normalizedQuery && !value.toLocaleLowerCase().includes(normalizedQuery))) {
      continue;
    }
    values.add(value);
    if (values.size >= Math.min(100, Math.max(1, limit))) break;
  }

  return [...values].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function toDatasetSearchResult(
  dataset: DatasetRecord,
  snapshot?: SnapshotRecord | null
): DatasetSearchResult {
  const metadataText = (value: string | null) => {
    if (dataset.provider !== 'GOVDATA' || value == null) return value;
    return normalizeGovDataText(value) || null;
  };

  return {
    id: dataset.id,
    provider: dataset.provider,
    providerDatasetId: dataset.provider_dataset_id,
    providerResourceId: dataset.provider_resource_id,
    title: metadataText(dataset.title) ?? dataset.title,
    description: metadataText(dataset.description),
    publisher: metadataText(dataset.publisher),
    license: metadataText(dataset.license),
    sourceUrl: dataset.source_url,
    modified: dateToIso(dataset.updated_at),
    structureSummary: metadataText(dataset.structure_summary),
    formatSummary: snapshot?.format?.toUpperCase() ?? undefined,
    valueSummary: snapshot
      ? `${Number(snapshot.row_count).toLocaleString()} rows · ${Number(snapshot.column_count).toLocaleString()} columns`
      : undefined,
    snapshotId: snapshot?.id ?? null,
    snapshotKey: snapshot?.snapshot_key ?? null,
    snapshotTakenAt: dateToIso(snapshot?.snapshot_taken_at),
    rowCount: snapshot ? Number(snapshot.row_count) : null,
    columnCount: snapshot ? Number(snapshot.column_count) : null,
    columnProfiles: asColumnProfiles(snapshot?.column_profiles ?? dataset.column_profiles),
    byteSize: snapshot ? Number(snapshot.byte_size) : null,
    groupId: dataset.group_id,
    timeCoverage: dataset.time_coverage as DatasetSearchResult['timeCoverage'],
    spatialCoverage: dataset.spatial_coverage as DatasetSearchResult['spatialCoverage'],
    metadata: dataset.metadata ?? {},
  };
}

export async function searchStoredDatasets({
  query,
  providers,
  groupId,
  userId,
  limit = 25,
}: {
  query: string;
  providers: readonly string[];
  groupId?: string | null;
  userId?: string | null;
  limit?: number;
}) {
  const normalizedQuery = query.trim();
  const normalizedProviders = normalizeProviderList(providers);
  const like = `%${normalizedQuery.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
  const rows = await sql<(DatasetRecord & { latest_snapshot: SnapshotRecord | null })[]>`
    SELECT
      d.*,
      to_jsonb(ds.*) AS latest_snapshot
    FROM dataset AS d
    LEFT JOIN LATERAL (
      SELECT *
      FROM dataset_snapshot AS nested
      WHERE nested.dataset_id = d.id
      ORDER BY nested.snapshot_taken_at DESC
      LIMIT 1
    ) AS ds ON true
    WHERE d.status = 'active'
      ${normalizedProviders.length > 0 ? sql`AND d.provider = ANY(${normalizedProviders})` : sql``}
      ${groupId ? sql`AND d.group_id = ${groupId}` : sql``}
      ${
        normalizedQuery.length >= 2
          ? sql`AND (
              d.title ILIKE ${like}
              OR d.description ILIKE ${like}
              OR d.provider_dataset_id ILIKE ${like}
              OR d.structure_summary ILIKE ${like}
              OR d.metadata::text ILIKE ${like}
            )`
          : sql``
      }
    ORDER BY d.updated_at DESC
    LIMIT ${Math.max(limit * 3, limit)}
  `;

  const visible: DatasetSearchResult[] = [];
  for (const row of rows) {
    if (await userCanReadDataset(userId, row)) {
      visible.push(toDatasetSearchResult(row, row.latest_snapshot));
    }
    if (visible.length >= limit) break;
  }
  return visible;
}

export async function archiveDataset(datasetId: string, userId: string) {
  const datasetRows = await sql<DatasetRecord[]>`
    SELECT *
    FROM dataset
    WHERE id = ${datasetId}
    LIMIT 1
  `;
  const dataset = datasetRows[0];
  if (!dataset) throw new Error('Dataset not found');
  if (!dataset.group_id) throw new Error('Only group-owned datasets can be archived here');
  await assertCanManageGroupDatasets(userId, dataset.group_id);

  await sql`
    UPDATE dataset
    SET status = 'archived', updated_at = now()
    WHERE id = ${datasetId}
  `;
}
