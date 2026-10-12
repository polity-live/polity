import { gunzipSync } from 'node:zlib';
import type {
  DatasetPreview,
  DatasetPreviewRequest,
  DatasetImportFilters,
  DatasetColumnProfile,
  EurostatDimension,
} from '@/features/charts/types';
import { normalizeDatasetArea } from '@/features/charts/logic/datasetSearch';
import { createStableHash } from '@/server/eurostat/hash';
import { createEurostatDataUrl } from '@/server/eurostat/metadata';
import { loadGovDataPackage, isGovDataCsvResource } from '@/server/govdata/catalogue';
import { assertSafePublicHttpUrl } from '@/server/govdata/safety';
import { getGenesisTableMetadata, readGenesisTable, loadGenesisSelection } from './genesis';
import { genesisSemantics, totalIdentity } from './semantics';
import { prepareEurostatDataset } from './providers';
import { loadSnapshotTable } from './service';
import { datasetYear, resolveImportFilters } from './importScope';
import { cachedPublicDatasetSearch } from './searchRuntime';
import {
  parseDatasetCsv,
  parseDatasetNumber,
  profileDatasetColumns,
  type DatasetTable,
} from './csv';
import { readLimitedResponseBytes, bytesToText } from './storage';
import { filterPreviewRows } from './previewRows';
export { filterPreviewRows } from './previewRows';
import { DatasetProviderFailure, providerResponseFailure } from './providerError';

export const DATASET_PREVIEW_BYTES = 2 * 1024 * 1024;

function result(
  request: DatasetPreviewRequest,
  table: DatasetTable,
  columns: DatasetColumnProfile[],
  metadata: Record<string, unknown>,
  appliedFilters: DatasetImportFilters,
  sampled: boolean
): DatasetPreview {
  const rowFilters = { ...request.rowFilters };
  const geo = columns.find(column => column.role === 'geo');
  const timeColumn = columns.find(column => column.role === 'time' && !column.technical);
  if (appliedFilters.area) {
    if (!geo)
      throw new DatasetProviderFailure(
        'The selected area is unavailable or ambiguous',
        'invalid_scope',
        422
      );
    const normalized = normalizeDatasetArea(appliedFilters.area);
    const dimension = (metadata.providerDimensions as EurostatDimension[] | undefined)?.find(
      item => item.id === geo.name
    );
    const matches = new Set([
      ...(dimension?.values
        .filter(
          value =>
            normalizeDatasetArea(value.id) === normalized ||
            normalizeDatasetArea(value.label ?? '') === normalized
        )
        .map(value => value.id) ?? []),
      ...table.rows
        .filter(row => normalizeDatasetArea(row[geo.name] ?? '') === normalized)
        .map(row => row[geo.name]),
    ]);
    // GENESIS semantics confirm national totals independently of their intentionally empty source key.
    if (
      request.provider === 'GENESIS_DESTATIS' &&
      geo.name === 'DINSGF' &&
      normalized === normalizeDatasetArea('Deutschland') &&
      table.rows.some(row => row[geo.name] === totalIdentity(geo.name))
    )
      matches.add(totalIdentity(geo.name));
    if (matches.size !== 1)
      throw new DatasetProviderFailure(
        'The selected area is unavailable or ambiguous',
        'invalid_scope',
        422
      );
    rowFilters[geo.name] = [...matches][0];
  }
  const timeRange =
    request.timeRange ??
    (appliedFilters.period && timeColumn
      ? {
          column: timeColumn.name,
          startYear: appliedFilters.period.start,
          endYear: appliedFilters.period.end,
        }
      : undefined);
  let rows = filterPreviewRows(table, rowFilters, timeRange, request.rowConditions);
  const time =
    request.sort?.column ??
    columns.find(column => column.role === 'time' && !column.technical)?.name;
  if (time && !table.columns.includes(time))
    throw new DatasetProviderFailure('Unknown sort column', 'invalid_scope', 422);
  if (time) {
    const direction = request.sort?.direction === 'desc' ? -1 : 1;
    rows = [...rows].sort(
      (a, b) =>
        direction *
        (columns.find(column => column.name === time)?.type === 'number'
          ? (parseDatasetNumber(a[time] ?? '') || 0) - (parseDatasetNumber(b[time] ?? '') || 0)
          : (a[time] ?? '').localeCompare(b[time] ?? '', undefined, { numeric: true }))
    );
  }
  const offset = request.page?.offset ?? 0;
  const limit = request.page?.limit ?? 5;
  const facets = request.page
    ? Object.fromEntries(
        table.columns.map(column => {
          const values = new Set<string>();
          let complete = true;
          for (const row of table.rows) {
            values.add(row[column] ?? '');
            if (values.size > 100) {
              complete = false;
              break;
            }
          }
          return [column, { values: [...values].slice(0, 100), complete: complete && !sampled }];
        })
      )
    : undefined;
  return {
    identity: {
      provider: request.provider,
      providerDatasetId: request.providerDatasetId,
      providerResourceId: request.providerResourceId,
      snapshotId: request.snapshotId,
      datasetId: request.datasetId,
    },
    columns,
    rows: rows.slice(offset, offset + limit),
    appliedFilters,
    rowFilters,
    timeRange,
    sampled,
    sampledRowCount: rows.length,
    metadata,
    ...(request.page
      ? {
          facets,
          page: {
            offset,
            limit,
            total: rows.length,
            nextOffset: offset + limit < rows.length ? offset + limit : null,
          },
        }
      : {}),
  };
}

/** Read only. Private snapshots are authorized on every call and never enter the shared public cache. */
export async function previewDataset(
  request: DatasetPreviewRequest,
  userId?: string | null,
  signal?: AbortSignal
): Promise<DatasetPreview> {
  if (request.snapshotId) {
    const { table, snapshot, dataset } = await loadSnapshotTable(
      request.snapshotId,
      userId,
      signal
    );
    if (
      request.provider !== dataset.provider ||
      (request.datasetId && request.datasetId !== dataset.id) ||
      (request.providerDatasetId && request.providerDatasetId !== dataset.provider_dataset_id) ||
      (request.providerResourceId && request.providerResourceId !== dataset.provider_resource_id)
    )
      throw new DatasetProviderFailure('Snapshot identity mismatch', 'invalid_response', 409);
    const profiles = snapshot.column_profiles as DatasetColumnProfile[];
    const effective = {
      ...request,
      datasetId: dataset.id,
      providerDatasetId: dataset.provider_dataset_id,
      providerResourceId: dataset.provider_resource_id,
    };
    return result(
      effective,
      table,
      profiles,
      snapshot.metadata ?? {},
      request.filters ?? {},
      false
    );
  }

  // Cache the bounded public sample independently of scrolling and client-side row predicates.
  // Snapshot rows remain permission-dependent and bypass this cache.
  const sourceRequest = {
    ...request,
    rowFilters: undefined,
    rowConditions: undefined,
    sort: undefined,
    timeRange: undefined,
    page: { offset: 0, limit: 10_000 },
  };
  const browsing = Boolean(request.page);
  const key = `dataset-preview:${createStableHash({ ...sourceRequest, browsing })}`;
  const source = (
    await cachedPublicDatasetSearch(
      key,
      async inner => [await externalPreview(sourceRequest, inner, browsing)],
      signal,
      20_000
    )
  )[0];
  return result(
    request,
    { columns: source.columns.map(column => column.name), rows: source.rows },
    source.columns,
    source.metadata ?? {},
    source.appliedFilters,
    source.sampled
  );
}

async function externalPreview(
  request: DatasetPreviewRequest,
  signal: AbortSignal,
  browsing: boolean
) {
  const code = request.providerDatasetId;
  if (!code) throw new DatasetProviderFailure('Dataset code is required', 'invalid_scope', 422);
  const language = request.language ?? 'de';
  let applied: DatasetImportFilters = { ...request.filters };
  if (request.provider === 'GENESIS_DESTATIS') {
    const entry = await getGenesisTableMetadata(code, language, signal);
    if (!applied.period && (!browsing || applied.period !== null)) {
      const year = datasetYear(String(entry.Time?.To ?? ''));
      if (year !== null) applied = { ...applied, period: { start: year, end: year } };
    }
    if (
      (applied.area &&
        normalizeDatasetArea(applied.area) !== normalizeDatasetArea('Deutschland')) ||
      Object.keys(applied.dimensions ?? {}).some(id => id !== 'value_variable_code')
    ) {
      const loaded = await loadGenesisSelection(
        code,
        language,
        applied,
        signal,
        DATASET_PREVIEW_BYTES
      );
      return result(request, loaded.table, loaded.profiles, loaded.metadata, applied, true);
    }
    const data: Record<string, string | boolean> = {};
    if (applied.period) {
      data.startyear = String(
        applied.period.start === 1800
          ? (datasetYear(String(entry.Time?.From ?? '')) ?? 1800)
          : applied.period.start
      );
      data.endyear = String(
        applied.period.end === 2199
          ? (datasetYear(String(entry.Time?.To ?? '')) ?? 2199)
          : applied.period.end
      );
    }
    if (applied.dimensions?.value_variable_code) {
      const measures = Array.isArray(entry.Structure?.Columns)
        ? entry.Structure.Columns
        : [entry.Structure?.Columns];
      if (
        !measures.some(
          (item: { Code?: string }) => item?.Code === applied.dimensions?.value_variable_code
        )
      )
        throw new DatasetProviderFailure('Unknown measure', 'invalid_scope', 422);
      data.contents = applied.dimensions.value_variable_code;
    }
    let table = await readGenesisTable(code, language, data, signal, DATASET_PREVIEW_BYTES);
    if (applied.area) {
      if (table.columns.includes('DINSGF') && /Deutschland|Germany/i.test(String(entry.Content)))
        table = {
          ...table,
          rows: table.rows.filter(row => row.DINSGF === totalIdentity('DINSGF')),
        };
      else if (!table.columns.includes('DINSG'))
        throw new DatasetProviderFailure(
          'National total cannot be confirmed',
          'invalid_scope',
          422
        );
    }
    if (
      applied.period &&
      table.rows.some(row => {
        const year = datasetYear(row.time);
        return (
          year === null ||
          year < (applied.period?.start ?? 0) ||
          year > (applied.period?.end ?? 2199)
        );
      })
    )
      throw new DatasetProviderFailure(
        'Response changed the selected period',
        'invalid_scope',
        422
      );
    const semantic = genesisSemantics(table, [], language, String(entry.Content));
    return result(request, semantic.table, semantic.profiles, semantic.metadata, applied, true);
  }
  if (request.provider === 'EUROSTAT') {
    const preparation = await prepareEurostatDataset(code, language, applied, signal);
    const resolved = resolveImportFilters(preparation, applied);
    const selected = { ...resolved };
    const added: Record<string, string> = { ...applied.dimensions };
    // A data sample fixes unspecified dimensions explicitly; it never claims to be the full dataset.
    for (const dimension of preparation.dimensions)
      if (
        !selected[dimension.id] &&
        dimension.values.length &&
        !(browsing && dimension.id === preparation.timeDimension)
      ) {
        const value =
          dimension.id === preparation.timeDimension
            ? dimension.values[dimension.values.length - 1]
            : dimension.values[0];
        selected[dimension.id] = [value.id];
        added[dimension.id] = value.id;
      }
    applied = { ...applied, dimensions: added };
    const response = await fetch(createEurostatDataUrl(code, selected), {
      signal,
      headers: { Accept: 'application/vnd.sdmx.data+csv;version=2.0.0;labels=id' },
    });
    if (!response.ok)
      throw new DatasetProviderFailure('Eurostat sample is unavailable', 'unavailable');
    try {
      const bytes = await readLimitedResponseBytes(
        response,
        'Eurostat sample',
        DATASET_PREVIEW_BYTES
      );
      const decoded =
        bytes[0] === 0x1f && bytes[1] === 0x8b
          ? gunzipSync(bytes, { maxOutputLength: DATASET_PREVIEW_BYTES })
          : bytes;
      const table = parseDatasetCsv(bytesToText(decoded, response.headers.get('content-type')), {
        maxRows: 1_000_000,
      });
      if (!table.columns.includes('OBS_VALUE'))
        throw new DatasetProviderFailure('Invalid sample columns', 'invalid_response');
      for (const row of table.rows)
        for (const [id, values] of Object.entries(selected))
          if (!values.includes(row[id]))
            throw new DatasetProviderFailure(
              'Sample changed the selected filters',
              'invalid_scope',
              422
            );
      const profiles = profileDatasetColumns(table).map(profile => ({
        ...profile,
        role:
          profile.name === 'OBS_VALUE'
            ? ('measure' as const)
            : profile.name === 'TIME_PERIOD'
              ? ('time' as const)
              : profile.name === 'geo'
                ? ('geo' as const)
                : ('dimension' as const),
        technical: ![
          'OBS_VALUE',
          'TIME_PERIOD',
          ...preparation.dimensions.map(item => item.id),
        ].includes(profile.name),
      }));
      return result(
        request,
        table,
        profiles,
        { providerDimensions: preparation.dimensions },
        applied,
        true
      );
    } catch (error) {
      throw providerResponseFailure(error, 'Eurostat');
    }
  }
  if (request.provider === 'GOVDATA') {
    const pkg = await loadGovDataPackage(code, signal);
    const resource = pkg.resources?.find(item => item.id === request.providerResourceId);
    if (!resource || !isGovDataCsvResource(resource))
      throw new DatasetProviderFailure('CSV resource not found', 'invalid_scope', 422);
    const response = await fetch(
      assertSafePublicHttpUrl(String(resource.download_url || resource.url || resource.access_url)),
      { signal }
    );
    if (!response.ok || !response.body)
      throw new DatasetProviderFailure('CSV sample unavailable', 'unavailable');
    const reader = response.body.getReader();
    let bytes = new Uint8Array();
    let table: DatasetTable | undefined;
    try {
      while (true) {
        const { value, done } = await reader.read();
        const budgetReached = Boolean(
          value && bytes.byteLength + value.byteLength >= DATASET_PREVIEW_BYTES
        );
        if (value) {
          const accepted = value.subarray(0, DATASET_PREVIEW_BYTES - bytes.byteLength);
          const next = new Uint8Array(bytes.byteLength + accepted.byteLength);
          next.set(bytes);
          next.set(accepted, bytes.length);
          bytes = next;
        }
        // Decode only through a complete line boundary: a chunk may end midway through UTF-8.
        const complete =
          done && !budgetReached ? bytes : bytes.subarray(0, bytes.lastIndexOf(10) + 1);
        const csv = bytesToText(complete, response.headers.get('content-type'));
        // Only complete CSV records, including quoted multiline fields, are considered.
        try {
          table = parseDatasetCsv(csv, {
            maxRows: 1_000_000,
          });
        } catch {
          if (done) throw new DatasetProviderFailure('Invalid CSV sample', 'invalid_response');
        }
        if (table) {
          const profiles = profileDatasetColumns(table);
          const time = profiles.find(item => item.role === 'time');
          const geo = profiles.find(item => item.role === 'geo');
          if ((applied.area && !geo) || (applied.period && !time))
            throw new DatasetProviderFailure('CSV scope cannot be resolved', 'invalid_scope', 422);
          table = {
            ...table,
            rows: table.rows.filter(
              row =>
                (!applied.area ||
                  normalizeDatasetArea(row[geo?.name ?? '']) ===
                    normalizeDatasetArea(applied.area)) &&
                (!applied.period ||
                  (() => {
                    const year = datasetYear(row[time?.name ?? '']);
                    return (
                      year !== null &&
                      year >= (applied.period?.start ?? 0) &&
                      year <= (applied.period?.end ?? 2199)
                    );
                  })())
            ),
          };
          if (budgetReached && table.rows.length === 0)
            throw new DatasetProviderFailure('Narrow the CSV sample', 'too_large', 413);
          if (table.rows.length >= (browsing ? 5_000 : 5) || done || budgetReached)
            return result(request, table, profiles, {}, applied, !done);
        }
        if (budgetReached)
          throw new DatasetProviderFailure('Narrow the CSV sample', 'too_large', 413);
        if (done) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
  throw new DatasetProviderFailure('Dataset preview unavailable', 'invalid_scope', 422);
}
