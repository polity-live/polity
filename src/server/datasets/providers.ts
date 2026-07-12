import { gunzipSync } from 'node:zlib';
import type {
  DatasetProviderId,
  DatasetProviderSearchResponse,
  DatasetSearchResult,
  EurostatCatalogueEntry,
} from '@/features/charts/types';
import { searchEurostatCatalogue } from '@/server/eurostat/catalogue';
import { createEurostatDataUrl, getEurostatDatasetDetails } from '@/server/eurostat/metadata';
import {
  isGovDataCsvResource,
  loadGovDataPackage,
  normalizeGovDataText,
  searchGovDataCatalogue,
} from '@/server/govdata/catalogue';
import { assertSafePublicHttpUrl } from '@/server/govdata/safety';
import { parseDatasetCsv } from './csv';
import { searchGenesisDatasets } from './genesis';
import { persistDatasetSnapshot, searchStoredDatasets } from './service';
import { bytesToText, readLimitedResponseBytes } from './storage';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized ? normalized : null;
}

function extraValue(
  extras: readonly { key?: string | null; value?: string | null }[] | undefined,
  key: string
) {
  return extras?.find(extra => extra.key === key)?.value ?? null;
}

function decodePossiblyGzippedCsv(bytes: Uint8Array, response: Response) {
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const isGzip =
    contentDisposition.toLowerCase().includes('.gz') ||
    (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);
  return new TextDecoder().decode(isGzip ? gunzipSync(bytes) : bytes);
}

const SEARCH_CONCEPTS = [
  {
    matches: [
      'bip',
      'gdp',
      'gnp',
      'bruttoinlandsprodukt',
      'gross domestic product',
      'gross national product',
    ],
    queries: ['Bruttoinlandsprodukt', 'gross domestic product', 'GDP'],
  },
  {
    matches: ['arbeitslosigkeit', 'unemployment'],
    queries: ['Arbeitslosigkeit', 'unemployment'],
  },
  {
    matches: ['bevölkerung', 'bevoelkerung', 'population'],
    queries: ['Bevölkerung', 'population'],
  },
] as const;

export function getDatasetSearchQueries(query: string) {
  const normalized = query.trim();
  const lower = normalized.toLocaleLowerCase('de');
  const concept = SEARCH_CONCEPTS.find(entry =>
    entry.matches.some(candidate => lower.includes(candidate))
  );
  return [...new Set([normalized, ...(concept?.queries ?? [])])].filter(value => value.length >= 2);
}

export async function importGovDataDatasetSnapshot({
  packageId,
  resourceId,
  userId,
}: {
  packageId: string;
  resourceId: string;
  userId: string;
}) {
  const pkg = await loadGovDataPackage(packageId);
  const resource = (pkg.resources ?? []).find(candidate => candidate.id === resourceId);
  if (!resource) throw new Error('GovData resource was not found');
  if (!isGovDataCsvResource(resource)) throw new Error('GovData resource is not an importable CSV');

  const resourceUrl =
    text(resource.download_url) || text(resource.url) || text(resource.access_url);
  const url = assertSafePublicHttpUrl(resourceUrl);
  const response = await fetch(url, {
    headers: { Accept: 'text/csv,application/csv,text/plain;q=0.9,*/*;q=0.1' },
  });
  if (!response.ok) throw new Error(`GovData resource download failed with ${response.status}`);

  const bytes = await readLimitedResponseBytes(response, 'GovData resource');
  const table = parseDatasetCsv(bytesToText(bytes));
  const organizationTitle = nullableText(
    normalizeGovDataText(pkg.organization?.title ?? pkg.organization?.name)
  );
  const resourceModified = nullableText(
    resource.modified ?? resource.last_modified ?? resource.metadata_modified
  );
  const publisher = nullableText(
    normalizeGovDataText(extraValue(pkg.extras ?? undefined, 'publisher_name') ?? pkg.maintainer)
  );
  const importedAt = new Date().toISOString();

  return persistDatasetSnapshot({
    provider: 'GOVDATA',
    providerDatasetId: text(pkg.id),
    providerResourceId: resourceId,
    title: normalizeGovDataText(pkg.title) || text(pkg.name) || 'GovData dataset',
    description: nullableText(normalizeGovDataText(pkg.notes)),
    publisher: publisher ?? organizationTitle,
    license: nullableText(normalizeGovDataText(pkg.license_title)),
    sourceUrl: url.toString(),
    structureSummary: `${table.rows.length.toLocaleString()} rows · ${table.columns.length.toLocaleString()} columns`,
    metadata: {
      packageId: text(pkg.id),
      packageName: text(pkg.name),
      resourceId,
      resourceName: normalizeGovDataText(resource.name) || 'CSV resource',
      resourceUrl: url.toString(),
      organizationTitle,
      modified: nullableText(pkg.modified ?? pkg.metadata_modified),
      resourceModified,
      importedAt,
    },
    snapshotTakenAt: resourceModified ?? importedAt,
    createdById: userId,
    table,
  });
}

export async function importEurostatDatasetSnapshot({
  code,
  language,
  userId,
}: {
  code: string;
  language: string;
  userId: string;
}) {
  const details = await getEurostatDatasetDetails(code, language);
  if (!details.importAllowed) {
    throw new Error('Estimated Eurostat dataset size exceeds the 50 MiB snapshot limit');
  }

  const response = await fetch(createEurostatDataUrl(details.code, {}), {
    headers: {
      Accept: 'application/vnd.sdmx.data+csv;version=2.0.0;labels=id',
    },
  });
  if (!response.ok) throw new Error(`Eurostat data request failed with ${response.status}`);

  const bytes = await readLimitedResponseBytes(response, 'Eurostat dataset');
  const csvText = decodePossiblyGzippedCsv(bytes, response);
  if (csvText.trim().startsWith('<')) {
    throw new Error('Eurostat returned an asynchronous or non-CSV response for this dataset');
  }
  const table = parseDatasetCsv(csvText);

  return persistDatasetSnapshot({
    provider: 'EUROSTAT',
    providerDatasetId: details.code,
    title: details.title,
    description: details.title,
    publisher: 'Eurostat',
    language: details.language,
    sourceUrl: `https://ec.europa.eu/eurostat/databrowser/view/${encodeURIComponent(details.code)}/default/table`,
    structureSummary: `${details.dimensions.length} dimensions · ${table.rows.length.toLocaleString()} rows`,
    dimensions: details.dimensions,
    timeCoverage: { start: details.dataStart, end: details.dataEnd },
    metadata: {
      snapshotKey: details.snapshotKey,
      sourceLastUpdate: details.lastUpdate,
      structureLastChange: details.structureLastChange,
      attributes: details.attributes,
      valueCount: details.valueCount,
    },
    snapshotTakenAt: details.lastUpdate ?? new Date().toISOString(),
    createdById: userId,
    table,
  });
}

function eurostatSearchResult(entry: EurostatCatalogueEntry): DatasetSearchResult {
  return {
    id: `eurostat:${entry.code}`,
    provider: 'EUROSTAT',
    providerDatasetId: entry.code,
    title: entry.title,
    description: entry.title,
    publisher: 'Eurostat',
    modified: entry.lastUpdate ?? entry.structureLastChange,
    timeCoverage: { start: entry.dataStart, end: entry.dataEnd },
    structureSummary: [
      entry.dataStart && entry.dataEnd ? `${entry.dataStart}-${entry.dataEnd}` : null,
      entry.type,
    ]
      .filter(Boolean)
      .join(' · '),
    formatSummary: entry.type,
    valueSummary: entry.valueCount.toLocaleString(),
    metadata: { ...entry },
    entry,
  };
}

export async function searchDatasetProviders({
  query,
  providers,
  groupId,
  userId,
  language = 'en',
  includeExternal = false,
}: {
  query: string;
  providers: readonly string[];
  groupId?: string | null;
  userId?: string | null;
  language?: string;
  includeExternal?: boolean;
}) {
  const selected = new Set(providers.map(provider => provider.toUpperCase()));
  const providerQueries = getDatasetSearchQueries(query);
  const includeAll = selected.size === 0;
  const searches: {
    provider: DatasetProviderId;
    promise: Promise<DatasetSearchResult[]>;
  }[] = [
    {
      provider: 'UPLOAD',
      promise: searchStoredDatasets({ query, providers, groupId, userId, limit: 25 }),
    },
  ];
  const shouldSearchExternal = includeExternal || !groupId;

  if (shouldSearchExternal && (includeAll || selected.has('EUROSTAT'))) {
    searches.push({
      provider: 'EUROSTAT',
      promise: Promise.all(
        providerQueries.map(providerQuery => searchEurostatCatalogue(providerQuery, language, 15))
      ).then(results => results.flat().map(eurostatSearchResult)),
    });
  }

  if (shouldSearchExternal && (includeAll || selected.has('GOVDATA'))) {
    searches.push({
      provider: 'GOVDATA',
      promise: Promise.all(
        providerQueries.map(providerQuery => searchGovDataCatalogue(providerQuery, 15))
      )
        .then(providerResults => providerResults.flat())
        .then(results =>
          results.flatMap<DatasetSearchResult>(entry =>
            entry.resources.map(resource => ({
              id: `govdata:${entry.id}:${resource.id}`,
              provider: 'GOVDATA',
              providerDatasetId: entry.id,
              providerResourceId: resource.id,
              title: entry.resources.length > 1 ? `${entry.title} · ${resource.name}` : entry.title,
              description: entry.notes,
              publisher: entry.publisher || entry.organizationTitle,
              modified: resource.modified ?? entry.modified,
              structureSummary: resource.name,
              formatSummary: resource.format || 'CSV',
              byteSize: resource.size,
              metadata: {
                packageName: entry.name,
                resourceName: resource.name,
                resourceModified: resource.modified,
              },
              entry: { ...entry, resources: [resource] },
            }))
          )
        ),
    });
  }

  if (shouldSearchExternal && (includeAll || selected.has('GENESIS_DESTATIS'))) {
    searches.push({
      provider: 'GENESIS_DESTATIS',
      promise: Promise.all(
        providerQueries.map(providerQuery =>
          searchGenesisDatasets(providerQuery, language === 'de' ? 'de' : 'en', 15)
        )
      ).then(results => results.flat()),
    });
  }

  const settled = await Promise.all(
    searches.map(async search => {
      try {
        return { provider: search.provider, results: await search.promise, error: null };
      } catch (error) {
        return {
          provider: search.provider,
          results: [] as DatasetSearchResult[],
          error: error instanceof Error ? error.message : 'Provider search failed',
        };
      }
    })
  );
  const results = settled.flatMap(result => result.results);
  const seen = new Set<string>();
  const uniqueResults = results.filter(result => {
    const key = `${result.provider}:${result.providerDatasetId ?? result.id}:${result.providerResourceId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    results: uniqueResults,
    errors: settled.flatMap(result =>
      result.error ? [{ provider: result.provider, message: result.error }] : []
    ),
  } satisfies DatasetProviderSearchResponse;
}
