import type {
  DatasetImportFilters,
  DatasetPreparation,
  DatasetSearchResult,
  EurostatDimension,
} from '@/features/charts/types';
import { MAX_DATASET_SNAPSHOT_BYTES } from '@/features/charts/types';
import { parseDatasetCsv } from './csv';
import { genesisSemantics, normalizeGenesisTable, totalIdentity } from './semantics';
export { normalizeGenesisTable } from './semantics';
import { persistDatasetSnapshot } from './service';
import { bytesToText, readLimitedResponseBytes } from './storage';
import { unzipFirstTextFile } from './zip';
import {
  assertGenesisStatus,
  postGenesis,
  readGenesisJson,
  type GenesisRequestBudget,
} from './genesisTransport';
import { datasetYear, importScopeResourceId, resolveImportFilters } from './importScope';
import { DatasetProviderFailure, providerResponseFailure } from './providerError';
import { cachedPublicDatasetSearch } from './searchRuntime';

const sourceUrl = 'https://www-genesis.destatis.de/genesis/online';
const text = (value: unknown) => String(value ?? '').trim();
const nullableText = (value: unknown) => text(value) || null;
const array = (value: unknown): Record<string, any>[] =>
  Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value as Record<string, any>]
      : [];
const tableCode = /^\d{5}-\d{4}$/;

function timeCoverage(value: unknown) {
  if (value && typeof value === 'object') {
    const time = value as { From?: string; To?: string };
    return { start: time.From, end: time.To };
  }
  const years = text(value).match(/(?:18|19|20|21)\d{2}/g);
  return years?.length ? { start: years[0], end: years.at(-1) } : null;
}

export async function searchGenesisDatasets(
  query: string,
  language = 'de',
  limit = 20,
  signal?: AbortSignal,
  budget?: GenesisRequestBudget
) {
  const term = query.trim();
  if (term.length < 2) return [];
  const isCode = tableCode.test(term);
  const response = await postGenesis(
    isCode ? 'catalogue/tables' : 'find/find',
    isCode
      ? {
          selection: term,
          area: 'free',
          searchcriterion: 'Code',
          sortcriterion: 'Code',
          pagelength: Math.min(50, Math.max(1, limit)),
          language: language === 'de' ? 'de' : 'en',
        }
      : {
          term,
          category: 'tables',
          pagelength: Math.min(50, Math.max(1, limit)),
          language: language === 'de' ? 'de' : 'en',
        },
    { signal, budget }
  );
  const body = await readGenesisJson(response);
  assertGenesisStatus(body);
  return genesisCatalogueResults(isCode ? body.List : body.Tables, limit);
}

function genesisCatalogueResults(value: unknown, limit: number) {
  return array(value)
    .flatMap<DatasetSearchResult>(entry => {
      const code = text(entry.Code);
      const title = text(entry.Content);
      if (!tableCode.test(code) || !title) return [];
      return [
        {
          id: `genesis:${code}`,
          provider: 'GENESIS_DESTATIS',
          providerDatasetId: code,
          title,
          description: nullableText(entry.Description),
          publisher: 'Statistisches Bundesamt (Destatis)',
          sourceUrl,
          modified: nullableText(entry.LatestUpdate),
          timeCoverage: timeCoverage(entry.Time),
          structureSummary: nullableText(entry.Time),
          formatSummary: 'FFCSV',
          valueSummary: nullableText(entry.State),
          metadata: { ...entry },
          entry,
        },
      ];
    })
    .slice(0, limit);
}

export async function searchGenesisTableCatalogue(
  prefix: string,
  language: string,
  signal?: AbortSignal,
  budget?: GenesisRequestBudget
) {
  if (!/^\d{5}-\*$/.test(prefix))
    throw new DatasetProviderFailure('Invalid GENESIS table selection', 'invalid_scope', 422);
  const response = await postGenesis(
    'catalogue/tables',
    {
      selection: prefix,
      area: 'free',
      searchcriterion: 'Code',
      sortcriterion: 'Code',
      pagelength: 50,
      language: language === 'de' ? 'de' : 'en',
    },
    { signal, budget }
  );
  const body = await readGenesisJson(response);
  assertGenesisStatus(body);
  return genesisCatalogueResults(body.List, 50);
}

export async function getGenesisTableMetadata(code: string, language = 'de', signal?: AbortSignal) {
  if (!tableCode.test(code))
    throw new DatasetProviderFailure('Invalid GENESIS table code', 'invalid_scope', 422);
  return (
    await cachedPublicDatasetSearch(
      `genesis-metadata:${language === 'de' ? 'de' : 'en'}:${code}`,
      async inner => [await loadGenesisTableMetadata(code, language, inner)],
      signal
    )
  )[0];
}

async function loadGenesisTableMetadata(code: string, language: string, signal: AbortSignal) {
  const response = await postGenesis(
    'metadata/table',
    { name: code, area: 'free', language: language === 'de' ? 'de' : 'en' },
    { signal }
  );
  const body = await readGenesisJson(response);
  assertGenesisStatus(body);
  const entry = body.Object;
  if (!entry || entry.Code !== code || !entry.Content)
    throw new DatasetProviderFailure('GENESIS table metadata is missing', 'invalid_response');
  return entry as Record<string, any>;
}

export function genesisMetadataDimensions(entry: Record<string, any>) {
  const dimensions = new Map<string, EurostatDimension>();
  const visit = (node: Record<string, any>) => {
    const code = text(node.Code);
    if (code && ['Merkmal', 'variable', 'Variable'].includes(node.Type) && Number(node.Values) > 0)
      dimensions.set(code, {
        id: code,
        label: text(node.Content) || code,
        position: dimensions.size + 1,
        values: [],
      });
    for (const child of array(node.Structure)) visit(child);
  };
  for (const nodes of Object.values(entry.Structure ?? {}))
    for (const node of array(nodes)) visit(node);
  const coverage = timeCoverage(entry.Time);
  const start = datasetYear(coverage?.start ?? '');
  const end = datasetYear(coverage?.end ?? '');
  if (start !== null && end !== null && end >= start)
    dimensions.set('time', {
      id: 'time',
      label: 'Time',
      position: 0,
      values: Array.from({ length: end - start + 1 }, (_, index) => ({
        id: String(start + index),
      })),
    });
  return [...dimensions.values()];
}

export function genesisSearchMetadata(
  entry: Record<string, any>,
  result: DatasetSearchResult
): DatasetSearchResult {
  const dimensions = genesisMetadataDimensions(entry);
  const germany =
    /\bDeutschland(?: insgesamt)?\b|\bGermany\b/i.test(text(entry.Content)) ||
    dimensions.some(dimension => dimension.id === 'DINSG');
  return {
    ...result,
    title: text(entry.Content),
    timeCoverage: timeCoverage(entry.Time),
    spatialCoverage: germany ? ['Deutschland'] : result.spatialCoverage,
    metadata: {
      ...result.metadata,
      searchAreaSource: germany ? 'metadata' : result.metadata?.searchAreaSource,
      genesisTable: entry,
      dimensions,
    },
  };
}

export async function prepareGenesisDataset(
  code: string,
  language = 'de',
  filters: DatasetImportFilters = {},
  signal?: AbortSignal
): Promise<DatasetPreparation> {
  const entry = await getGenesisTableMetadata(code, language, signal);
  const dimensions = genesisMetadataDimensions(entry);
  const geo = dimensions.find(
    dimension =>
      /DINSG|DLAND|LAND|KREIS|REGION|GEMEIN/i.test(dimension.id) ||
      /Deutschland|Bundesländer|Bundeslander|Kreise|Gemeinden|Region|countries|states/i.test(
        dimension.label
      )
  );
  for (const dimension of dimensions.filter(item => item.id !== 'time')) {
    dimension.values = (
      await cachedPublicDatasetSearch(
        `genesis-values:${language === 'de' ? 'de' : 'en'}:${dimension.id}`,
        async inner => {
          const response = await postGenesis(
            'catalogue/values2variable',
            {
              name: dimension.id,
              selection: '*',
              area: 'all',
              searchcriterion: 'Code',
              sortcriterion: 'Code',
              pagelength: '25000',
              language: language === 'de' ? 'de' : 'en',
            },
            { signal: inner, timeoutMs: 30_000 }
          );
          const body = await readGenesisJson(response);
          assertGenesisStatus(body);
          return array(body.List)
            .map(value => ({ id: text(value.Code), label: text(value.Content) }))
            .filter(value => value.id);
        },
        signal,
        30_000
      )
    )
      .filter(
        (value, index, values) =>
          !value.id.startsWith('__total__:') &&
          values.findIndex(item => item.id === value.id) === index
      )
      .map(value => ({ ...value }));
  }
  const measures = array(entry.Structure?.Columns).filter(
    item => Number(item.Values) === -1 && ['Merkmal', 'variable', 'Variable'].includes(item.Type)
  );
  if (measures.length)
    dimensions.push({
      id: 'value_variable_code',
      label: language === 'de' ? 'Kennzahl' : 'Measure',
      position: dimensions.length,
      values: measures.map(item => ({ id: text(item.Code), label: text(item.Content) })),
    });
  if (geo?.id === 'DINSGF' && measures.length && /Deutschland|Germany/i.test(text(entry.Content))) {
    const year = datasetYear(timeCoverage(entry.Time)?.end ?? '');
    if (year !== null) {
      const totals = await cachedPublicDatasetSearch(
        `genesis-total:${code}:${language}`,
        async inner => {
          const table = await readGenesisTable(
            code,
            language,
            { startyear: String(year), endyear: String(year), contents: text(measures[0].Code) },
            inner,
            2 * 1024 * 1024
          );
          return table.rows.some(row => row.DINSGF === totalIdentity('DINSGF'))
            ? [
                {
                  id: totalIdentity('DINSGF'),
                  label: language === 'de' ? 'Deutschland' : 'Germany',
                },
              ]
            : [];
        },
        signal,
        20_000
      );
      geo.values.push(...totals);
    }
  }
  return {
    provider: 'GENESIS_DESTATIS',
    code,
    title: text(entry.Content),
    dimensions,
    geoDimension: geo?.id,
    timeDimension: dimensions.some(item => item.id === 'time') ? 'time' : null,
    estimatedBytes: null,
    importAllowed: true,
    suggestedFilters: filters,
    spatialCoverage: geo?.id === 'DINSG' ? ['Deutschland'] : null,
    timeCoverage: timeCoverage(entry.Time),
  };
}

/** Bounded read without persistence; also used by the preview endpoint and total verification. */
export async function readGenesisTable(
  code: string,
  language: string,
  data: Record<string, string | boolean>,
  signal?: AbortSignal,
  maxBytes = MAX_DATASET_SNAPSHOT_BYTES
) {
  try {
    const response = await postGenesis(
      'data/tablefile',
      {
        name: code,
        area: 'free',
        format: 'ffcsv',
        compress: false,
        language: language === 'de' ? 'de' : 'en',
        ...data,
      },
      { signal, timeoutMs: maxBytes < MAX_DATASET_SNAPSHOT_BYTES ? 20_000 : 120_000, maxBytes }
    );
    const bytes = await readLimitedResponseBytes(response, 'GENESIS dataset', maxBytes);
    const contentType = response.headers.get('content-type') ?? '';
    const csvText =
      contentType.includes('zip') || (bytes[0] === 0x50 && bytes[1] === 0x4b)
        ? unzipFirstTextFile(bytes, maxBytes)
        : bytesToText(bytes, contentType);
    if (new TextEncoder().encode(csvText).byteLength > maxBytes)
      throw new DatasetProviderFailure('Reduce the selected scope', 'too_large', 413);
    if (csvText.trim().startsWith('{')) {
      assertGenesisStatus(JSON.parse(csvText), true);
      throw new DatasetProviderFailure(
        'GENESIS returned no CSV; reduce the selection',
        'too_large',
        413
      );
    }
    const table = normalizeGenesisTable(parseDatasetCsv(csvText, { maxRows: 1_000_000 }));
    if (!table.columns.includes('value') || !table.columns.includes('time'))
      throw new DatasetProviderFailure(
        'GENESIS returned invalid FFCSV columns',
        'invalid_response'
      );
    if (table.rows.some(row => row.statistics_code && row.statistics_code !== code.slice(0, 5)))
      throw new DatasetProviderFailure(
        'GENESIS returned a different statistic',
        'invalid_response'
      );
    return table;
  } catch (error) {
    throw providerResponseFailure(error, 'GENESIS');
  }
}

export async function loadGenesisSelection(
  code: string,
  language: string,
  filters: DatasetImportFilters = {},
  signal?: AbortSignal,
  maxBytes = MAX_DATASET_SNAPSHOT_BYTES
) {
  const preparation = await prepareGenesisDataset(code, language, filters, signal);
  const resolved = resolveImportFilters(preparation, filters);
  const data: Record<string, string | boolean> = {};
  if (filters.period) {
    const availableYears = (resolved[preparation.timeDimension ?? 'time'] ?? [])
      .map(datasetYear)
      .filter((year): year is number => year !== null);
    data.startyear = String(
      filters.period.start === 1800 && availableYears.length
        ? Math.min(...availableYears)
        : filters.period.start
    );
    data.endyear = String(
      filters.period.end === 2199 && availableYears.length
        ? Math.max(...availableYears)
        : filters.period.end
    );
  }
  const geo = preparation.geoDimension;
  const total = geo && resolved[geo]?.[0] === totalIdentity(geo);
  if (geo && resolved[geo] && !total) {
    data.regionalvariable = geo;
    data.regionalkey = resolved[geo][0];
  }
  let index = 1;
  for (const [id, values] of Object.entries(resolved)) {
    if (id === geo || id === 'time' || id === 'value_unit') continue;
    if (id === 'value_variable_code') {
      data.contents = values[0];
      continue;
    }
    if (index > 5)
      throw new DatasetProviderFailure('Too many classifying filters', 'invalid_scope', 422);
    data[`classifyingvariable${index}`] = id;
    data[`classifyingkey${index++}`] = values[0];
  }
  let table = await readGenesisTable(code, language, data, signal, maxBytes);
  // Total has no native regional key. Keep the explicitly identified official observations only.
  if (total && geo)
    table = { ...table, rows: table.rows.filter(row => row[geo] === totalIdentity(geo)) };
  if (resolved.value_unit)
    table = {
      ...table,
      rows: table.rows.filter(row => resolved.value_unit.includes(row.value_unit)),
    };
  for (const row of table.rows)
    for (const [id, values] of Object.entries(resolved)) {
      const value = id === 'time' ? String(datasetYear(row.time)) : row[id];
      if (value === undefined || !values.includes(value))
        throw new DatasetProviderFailure(
          'GENESIS returned data outside the selected scope',
          'invalid_scope',
          422
        );
    }
  const semantic = genesisSemantics(table, preparation.dimensions, language, preparation.title);
  return { ...semantic, preparation, resolved };
}

export async function importGenesisDatasetSnapshot({
  code,
  language = 'de',
  userId,
  filters,
  signal,
}: {
  code: string;
  language?: string;
  userId: string;
  filters?: DatasetImportFilters;
  signal?: AbortSignal;
}) {
  const normalizedCode = code.trim();
  const result = await loadGenesisSelection(normalizedCode, language, filters, signal);
  if (!result.table.rows.length)
    throw new DatasetProviderFailure('No data exists for the selected scope', 'invalid_scope', 422);
  const observedYears = result.table.rows
    .map(row => datasetYear(row.observation_period ?? row.time ?? ''))
    .filter((year): year is number => year !== null);
  return persistDatasetSnapshot({
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: normalizedCode,
    providerResourceId: importScopeResourceId(result.resolved),
    title: result.preparation.title,
    publisher: 'Statistisches Bundesamt (Destatis)',
    sourceUrl,
    language,
    timeCoverage: filters?.period
      ? {
          start: String(
            filters.period.start === 1800 && observedYears.length
              ? Math.min(...observedYears)
              : filters.period.start
          ),
          end: String(
            filters.period.end === 2199 && observedYears.length
              ? Math.max(...observedYears)
              : filters.period.end
          ),
        }
      : result.preparation.timeCoverage,
    spatialCoverage: filters?.area ? [filters.area] : result.preparation.spatialCoverage,
    dimensions: result.metadata.providerDimensions,
    columnProfiles: result.profiles,
    metadata: { source: 'GENESIS/Destatis', importScope: result.resolved, ...result.metadata },
    createdById: userId,
    table: result.table,
  });
}
