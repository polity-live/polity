import type {
  DatasetImportFilters,
  DatasetPreparation,
  DatasetSearchResult,
  EurostatDimension,
} from '@/features/charts/types';
import { MAX_DATASET_SNAPSHOT_BYTES } from '@/features/charts/types';
import { parseDatasetCsv, profileDatasetColumns, type DatasetTable } from './csv';
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
    dimension.values = await cachedPublicDatasetSearch(
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
    );
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

/** Modern FFCSV carries dimension identities in each row alongside its generic English column names. */
export function normalizeGenesisTable(table: DatasetTable) {
  if (!table.columns.includes('value') || !table.columns.includes('time')) return table;
  const ids = new Set<string>();
  const rows = table.rows.map(row => {
    const result = { ...row };
    for (const column of table.columns.filter(name => /^\d+_variable_code$/.test(name))) {
      const prefix = column.replace(/_code$/, '');
      const id = row[column];
      if (!id) continue;
      ids.add(id);
      result[id] = row[`${prefix}_attribute_code`] ?? '';
    }
    return result;
  });
  return { columns: [...new Set([...table.columns, ...ids])], rows };
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
  if (!normalizedCode)
    throw new DatasetProviderFailure('GENESIS dataset code is required', 'invalid_scope', 422);
  const preparation = await prepareGenesisDataset(normalizedCode, language, filters, signal);
  const resolved = resolveImportFilters(preparation, filters);
  const data: Record<string, string | boolean> = {
    name: normalizedCode,
    area: 'free',
    format: 'ffcsv',
    compress: false,
    language: language === 'de' ? 'de' : 'en',
  };
  if (filters?.period) {
    data.startyear = String(filters.period.start);
    data.endyear = String(filters.period.end);
  }
  if (preparation.geoDimension && resolved[preparation.geoDimension]) {
    data.regionalvariable = preparation.geoDimension;
    data.regionalkey = resolved[preparation.geoDimension][0];
  }
  let index = 1;
  for (const [id, values] of Object.entries(resolved)) {
    if (id === preparation.geoDimension || id === 'time') continue;
    if (index > 5)
      throw new DatasetProviderFailure(
        'GENESIS supports at most five classifying filters',
        'invalid_scope',
        422
      );
    data[`classifyingvariable${index}`] = id;
    data[`classifyingkey${index++}`] = values[0];
  }
  const response = await postGenesis('data/tablefile', data, { signal, timeoutMs: 120_000 });
  let table: DatasetTable;
  try {
    const bytes = await readLimitedResponseBytes(response, 'GENESIS dataset');
    const contentType = response.headers.get('content-type') ?? '';
    const csvText =
      contentType.includes('zip') || (bytes[0] === 0x50 && bytes[1] === 0x4b)
        ? unzipFirstTextFile(bytes)
        : bytesToText(bytes, contentType);
    if (csvText.trim().startsWith('{')) {
      assertGenesisStatus(JSON.parse(csvText), true);
      throw new DatasetProviderFailure(
        'GENESIS returned no CSV; reduce the import selection',
        'too_large',
        413
      );
    }
    if (new TextEncoder().encode(csvText).byteLength > MAX_DATASET_SNAPSHOT_BYTES)
      throw new DatasetProviderFailure(
        'GENESIS dataset exceeds the 50 MiB snapshot limit',
        'too_large',
        413
      );
    table = normalizeGenesisTable(parseDatasetCsv(csvText, { maxRows: 1_000_000 }));
    if (!table.columns.includes('value') || !table.columns.includes('time'))
      throw new DatasetProviderFailure(
        'GENESIS returned invalid FFCSV columns',
        'invalid_response'
      );
    if (!table.rows.length)
      throw new DatasetProviderFailure(
        'No data exists for the selected scope',
        'invalid_scope',
        422
      );
  } catch (error) {
    throw providerResponseFailure(error, 'GENESIS');
  }
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
  const profiles = profileDatasetColumns(table).map(profile => {
    if (profile.name === 'value') {
      const labels = [...new Set(table.rows.map(row => row.value_variable_label).filter(Boolean))];
      return {
        ...profile,
        label: labels.length === 1 ? labels[0] : profile.label,
        role: 'measure' as const,
        type: 'number' as const,
      };
    }
    if (profile.name === 'time')
      return {
        ...profile,
        label: table.rows[0]?.time_label || profile.label,
        role: 'time' as const,
        type: 'date' as const,
      };
    const dimension = preparation.dimensions.find(item => item.id === profile.name);
    return {
      ...profile,
      label: dimension?.label ?? profile.label,
      role:
        profile.name === preparation.geoDimension
          ? ('geo' as const)
          : dimension || ['value_unit', 'value_variable_code'].includes(profile.name)
            ? ('dimension' as const)
            : ('label' as const),
      type: 'category' as const,
    };
  });
  const actualDimensions = preparation.dimensions
    .filter(item => table.columns.includes(item.id))
    .map(item => ({
      ...item,
      values: item.values.filter(value =>
        table.rows.some(row =>
          item.id === 'time'
            ? datasetYear(row.time) === Number(value.id)
            : row[item.id] === value.id
        )
      ),
    }));
  for (const id of ['value_unit', 'value_variable_code'])
    if (table.columns.includes(id))
      actualDimensions.push({
        id,
        label:
          id === 'value_unit'
            ? language === 'de'
              ? 'Einheit'
              : 'Unit'
            : language === 'de'
              ? 'Kennzahl'
              : 'Measure',
        position: actualDimensions.length,
        values: [...new Set(table.rows.map(row => row[id]).filter(Boolean))].map(value => ({
          id: value,
          label:
            id === 'value_variable_code'
              ? table.rows.find(row => row[id] === value)?.value_variable_label || value
              : value,
        })),
      });
  return persistDatasetSnapshot({
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: normalizedCode,
    providerResourceId: importScopeResourceId(resolved),
    title: preparation.title,
    publisher: 'Statistisches Bundesamt (Destatis)',
    sourceUrl,
    language,
    timeCoverage: filters?.period
      ? { start: String(filters.period.start), end: String(filters.period.end) }
      : preparation.timeCoverage,
    spatialCoverage: filters?.area ? [filters.area] : preparation.spatialCoverage,
    dimensions: actualDimensions,
    columnProfiles: profiles,
    metadata: {
      source: 'GENESIS/Destatis',
      importScope: resolved,
      providerDimensions: actualDimensions,
      geoDimension: preparation.geoDimension,
      timeDimension: 'time',
    },
    createdById: userId,
    table,
  });
}
