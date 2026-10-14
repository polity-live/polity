import { gunzipSync } from 'node:zlib';
import type {
  DatasetProviderId,
  DatasetProviderSearchResponse,
  DatasetSearchResult,
  EurostatCatalogueEntry,
  DatasetSearchFilters,
  DatasetImportFilters,
  DatasetPreparation,
  DatasetSearchIntent,
} from '@/features/charts/types';
import { MAX_DATASET_SNAPSHOT_BYTES as SNAPSHOT_LIMIT } from '@/features/charts/types';
import {
  getDatasetTopicQueries,
  interpretDatasetSearch,
  rankDatasetSearchResults,
} from '@/features/charts/logic/datasetSearch';
import { cachedPublicDatasetSearch } from './searchRuntime';
import { searchEurostatCatalogue } from '@/server/eurostat/catalogue';
import { createEurostatDataUrl, getEurostatDatasetMetadata } from '@/server/eurostat/metadata';
import {
  isGovDataCsvResource,
  loadGovDataPackage,
  normalizeGovDataText,
  searchGovDataCatalogue,
} from '@/server/govdata/catalogue';
import { assertSafePublicHttpUrl } from '@/server/govdata/safety';
import { parseDatasetCsv, profileDatasetColumns, type DatasetTable } from './csv';
import { searchGenesisDatasets, getGenesisTableMetadata, genesisSearchMetadata } from './genesis';
import {
  DatasetProviderFailure,
  providerFailureCode,
  providerResponseFailure,
} from './providerError';
import { datasetYear, resolveImportFilters, importScopeResourceId } from './importScope';
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
  return bytesToText(
    isGzip ? gunzipSync(bytes, { maxOutputLength: SNAPSHOT_LIMIT }) : bytes,
    response.headers.get('content-type')
  );
}

export function getDatasetSearchQueries(query: string) {
  return getDatasetTopicQueries(interpretDatasetSearch(query));
}

export function getGovDataSearchQueries(query: string, filters?: DatasetSearchFilters) {
  const intent = interpretDatasetSearch(query, filters);
  const variants = getDatasetTopicQueries(intent);
  const required = (value: string) =>
    (value.match(/[\p{L}\p{N}_-]+/gu) ?? []).map(token => `+"${token}"`).join(' ');
  const topics = variants.map(required);
  const scoped =
    topics[0] && (intent.area || intent.period)
      ? `${topics[0]} ${intent.area ? required(intent.area) : ''} ${intent.period ? `+"${intent.period.end}"` : ''}`.trim()
      : null;
  return [...new Set(scoped ? [scoped, topics[0], topics[topics.length - 1]] : topics)].slice(0, 3);
}

async function collectSearchVariants(
  queries: string[],
  run: (query: string) => Promise<DatasetSearchResult[]>
) {
  const settled = await Promise.allSettled(queries.map(run));
  const failures = settled.filter(
    (item): item is PromiseRejectedResult => item.status === 'rejected'
  );
  return {
    results: settled.flatMap(item => (item.status === 'fulfilled' ? item.value : [])),
    error: failures.length
      ? failures[0].reason instanceof Error
        ? failures[0].reason.message
        : 'Provider search failed'
      : null,
  };
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
  const table = parseDatasetCsv(bytesToText(bytes, response.headers.get('content-type')));
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
      sourceUpdatedAt: resourceModified,
      importedAt,
    },
    snapshotTakenAt: importedAt,
    createdById: userId,
    table,
  });
}

export async function importEurostatDatasetSnapshot({
  code,
  language,
  userId,
  filters,
  signal,
}: {
  code: string;
  language: string;
  userId: string;
  filters?: DatasetImportFilters;
  signal?: AbortSignal;
}) {
  const details = await eurostatMetadata(code, language, signal);
  const preparation = eurostatPreparation(details, filters);
  const resolved = resolveImportFilters(preparation, filters);
  const ratio = details.dimensions.reduce(
    (ratio, dimension) =>
      ratio *
      (resolved[dimension.id] ? resolved[dimension.id].length / dimension.values.length : 1),
    1
  );
  if (preparation.estimatedBytes !== null && preparation.estimatedBytes * ratio > SNAPSHOT_LIMIT)
    throw new DatasetProviderFailure(
      'Estimated Eurostat dataset size exceeds the 50 MiB snapshot limit; reduce the import selection',
      'too_large',
      413
    );

  let response: Response;
  try {
    response = await fetch(createEurostatDataUrl(details.code, resolved), {
      signal,
      headers: { Accept: 'application/vnd.sdmx.data+csv;version=2.0.0;labels=id' },
    });
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw new DatasetProviderFailure('Eurostat connection failed', 'unavailable');
  }
  if (!response.ok)
    throw new DatasetProviderFailure(
      `Eurostat data request failed with ${response.status}`,
      'unavailable'
    );

  let table: DatasetTable;
  try {
    const bytes = await readLimitedResponseBytes(response, 'Eurostat dataset');
    const csvText = decodePossiblyGzippedCsv(bytes, response);
    if (csvText.trim().startsWith('<'))
      throw new DatasetProviderFailure(
        'Eurostat returned an asynchronous response; reduce the import selection',
        'too_large',
        413
      );
    if (new TextEncoder().encode(csvText).byteLength > SNAPSHOT_LIMIT)
      throw new DatasetProviderFailure(
        'Eurostat dataset exceeds the 50 MiB snapshot limit',
        'too_large',
        413
      );
    table = parseDatasetCsv(csvText, { maxRows: 1_000_000 });
    if (!table.columns.includes('OBS_VALUE'))
      throw new DatasetProviderFailure(
        'Eurostat returned invalid SDMX CSV columns',
        'invalid_response'
      );
    if (!table.rows.length)
      throw new DatasetProviderFailure(
        'No data exists for the selected scope',
        'invalid_scope',
        422
      );
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw providerResponseFailure(error, 'Eurostat');
  }
  for (const row of table.rows)
    for (const [id, values] of Object.entries(resolved))
      if (!values.includes(row[id]))
        throw new DatasetProviderFailure(
          'Eurostat returned data outside the selected scope',
          'invalid_scope',
          422
        );
  const profiles = profileDatasetColumns(table).map(profile => {
    const dimension = details.dimensions.find(item => item.id === profile.name);
    return {
      ...profile,
      label: dimension?.label ?? profile.label,
      role:
        profile.name === 'OBS_VALUE'
          ? ('measure' as const)
          : dimension
            ? profile.name === 'geo'
              ? ('geo' as const)
              : profile.name === 'TIME_PERIOD'
                ? ('time' as const)
                : ('dimension' as const)
            : ('label' as const),
      type:
        profile.name === 'OBS_VALUE'
          ? ('number' as const)
          : profile.name === 'TIME_PERIOD'
            ? ('date' as const)
            : ('category' as const),
    };
  });
  const actualDimensions = details.dimensions
    .filter(dimension => table.columns.includes(dimension.id))
    .map(dimension => ({
      ...dimension,
      values: dimension.values.filter(value =>
        table.rows.some(row => row[dimension.id] === value.id)
      ),
    }));

  const observedYears = table.rows
    .map(row => datasetYear(row.TIME_PERIOD ?? ''))
    .filter((year): year is number => year !== null);
  return persistDatasetSnapshot({
    provider: 'EUROSTAT',
    providerDatasetId: details.code,
    providerResourceId: importScopeResourceId(resolved),
    title: details.title,
    description: details.title,
    publisher: 'Eurostat',
    language: details.language,
    sourceUrl: `https://ec.europa.eu/eurostat/databrowser/view/${encodeURIComponent(details.code)}/default/table`,
    structureSummary: `${details.dimensions.length} dimensions · ${table.rows.length.toLocaleString()} rows`,
    dimensions: actualDimensions,
    columnProfiles: profiles,
    spatialCoverage: actualDimensions
      .find(item => item.id === 'geo')
      ?.values.map(value => value.label ?? value.id),
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
      : { start: details.dataStart, end: details.dataEnd },
    metadata: {
      snapshotKey: details.snapshotKey,
      sourceLastUpdate: details.lastUpdate,
      sourceUpdatedAt: details.lastUpdate,
      structureLastChange: details.structureLastChange,
      attributes: details.attributes,
      valueCount: details.valueCount,
      providerDimensions: actualDimensions,
      geoDimension: 'geo',
      timeDimension: 'TIME_PERIOD',
      importScope: resolved,
    },
    snapshotTakenAt: new Date().toISOString(),
    createdById: userId,
    table,
  });
}

async function eurostatMetadata(
  code: string,
  language: string,
  signal?: AbortSignal,
  entry?: EurostatCatalogueEntry
) {
  return (
    await cachedPublicDatasetSearch(
      `eurostat-metadata:${code.toUpperCase()}:${language}`,
      async innerSignal => {
        try {
          return [await getEurostatDatasetMetadata(code, language, innerSignal, entry)];
        } catch (error) {
          if (innerSignal.aborted) throw innerSignal.reason;
          throw providerResponseFailure(error, 'Eurostat metadata');
        }
      },
      signal
    )
  )[0];
}

function eurostatPreparation(
  details: Awaited<ReturnType<typeof getEurostatDatasetMetadata>>,
  filters: DatasetImportFilters = {}
): DatasetPreparation {
  return {
    provider: 'EUROSTAT',
    code: details.code,
    title: details.title,
    dimensions: details.dimensions,
    geoDimension: details.dimensions.find(item => item.id === 'geo')?.id,
    timeDimension: details.dimensions.find(item => item.id === 'TIME_PERIOD')?.id,
    estimatedBytes: details.estimatedBytes,
    importAllowed: details.importAllowed,
    suggestedFilters: filters,
    spatialCoverage: details.dimensions
      .find(item => item.id === 'geo')
      ?.values.map(value => value.label ?? value.id),
    timeCoverage: { start: details.dataStart, end: details.dataEnd },
    coverageRegions: details.coverageRegions,
  };
}

export async function prepareEurostatDataset(
  code: string,
  language: string,
  filters?: DatasetImportFilters,
  signal?: AbortSignal
) {
  return eurostatPreparation(await eurostatMetadata(code, language, signal), filters);
}

async function enrichedSourceSearch(
  provider: 'EUROSTAT' | 'GENESIS_DESTATIS',
  queries: string[],
  language: string,
  intent: DatasetSearchIntent,
  parentSignal?: AbortSignal,
  catalogueLanguage = language === 'de' ? 'de' : 'en'
) {
  const deadline = AbortSignal.timeout(8000);
  const signal = parentSignal ? AbortSignal.any([parentSignal, deadline]) : deadline;
  const budget = { remaining: 3 };
  let results: DatasetSearchResult[] = [];
  let error: string | null = null;
  let code: ReturnType<typeof providerFailureCode>;
  const recordError = (failure: unknown) => {
    error = failure instanceof Error ? failure.message : 'Provider search failed';
    code = providerFailureCode(failure);
  };
  if (provider === 'EUROSTAT') {
    const variants = await Promise.allSettled(
      queries
        .slice(0, 3)
        .map(query =>
          cachedPublicDatasetSearch(
            `eurostat:${language}:${query}`,
            inner => searchEurostatCatalogue(query, language, 50, inner),
            signal
          ).then(entries => entries.map(eurostatSearchResult))
        )
    );
    for (const variant of variants)
      if (variant.status === 'fulfilled') results.push(...variant.value);
      else recordError(variant.reason);
  } else {
    for (const query of queries.slice(0, 3)) {
      if (signal.aborted || budget.remaining <= 0) break;
      try {
        results.push(
          ...(await cachedPublicDatasetSearch(
            `genesis-tables-utf8:${catalogueLanguage}:${query}`,
            inner => searchGenesisDatasets(query, catalogueLanguage, 50, inner, budget),
            signal
          ))
        );
      } catch (failure) {
        recordError(failure);
      }
      // Reserve the remaining deadline for coverage instead of querying more synonyms after a useful page.
      if (rankDatasetSearchResults(results, intent).length >= 6) break;
    }
  }
  results = rankDatasetSearchResults(results, intent);
  if ((intent.area || intent.period || intent.isCode) && results.length) {
    const candidates = results
      .slice(0, 6)
      .filter(
        result =>
          provider !== 'GENESIS_DESTATIS' ||
          result.searchMatch?.area.status === 'unknown' ||
          result.searchMatch?.period.status === 'unknown'
      );
    const enrich = async (result: DatasetSearchResult) => {
      try {
        if (!result.providerDatasetId)
          throw new DatasetProviderFailure('Dataset code is missing', 'invalid_response');
        signal.throwIfAborted();
        if (provider === 'GENESIS_DESTATIS') {
          const entry = await getGenesisTableMetadata(result.providerDatasetId, language, signal);
          const updated = genesisSearchMetadata(entry, result);
          results = results.map(item => (item.id === result.id ? updated : item));
        } else {
          const details = await eurostatMetadata(
            result.providerDatasetId,
            language,
            signal,
            result.entry as EurostatCatalogueEntry
          );
          const preparation = eurostatPreparation(details);
          const areas = preparation.spatialCoverage;
          const periodYears = details.dimensions
            .find(item => item.id === 'TIME_PERIOD')
            ?.values.map(item => datasetYear(item.id))
            .filter((year): year is number => year !== null);
          let combinationMatches: boolean | undefined;
          if (intent.area || intent.period) {
            try {
              resolveImportFilters(preparation, { area: intent.area, period: intent.period });
              combinationMatches = true;
            } catch {
              combinationMatches = false;
            }
          }
          const updated = {
            ...result,
            spatialCoverage: areas,
            metadata: {
              ...result.metadata,
              searchPeriodYears: periodYears,
              searchScopeMatches: combinationMatches,
              dimensions: details.dimensions,
            },
          };
          results = results.map(item => (item.id === result.id ? updated : item));
        }
      } catch {
        error ??= 'Dataset coverage could not be completely verified';
        code ??= 'incomplete_metadata';
      }
    };
    if (provider === 'GENESIS_DESTATIS')
      for (const candidate of candidates) {
        if (signal.aborted) {
          error ??= 'Dataset coverage could not be completely verified';
          code ??= 'incomplete_metadata';
          break;
        }
        await enrich(candidate);
      }
    else await Promise.all(candidates.map(enrich));
    if (results.length > 6 && results.slice(6).some(item => !item.spatialCoverage)) {
      error ??= 'Dataset coverage could not be completely verified';
      code ??= 'incomplete_metadata';
    }
  }
  return { results, error, code };
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
  filters,
  signal,
}: {
  query: string;
  providers: readonly string[];
  groupId?: string | null;
  userId?: string | null;
  language?: string;
  includeExternal?: boolean;
  filters?: DatasetSearchFilters;
  signal?: AbortSignal;
}) {
  const selected = new Set(providers.map(provider => provider.toUpperCase()));
  const intent = interpretDatasetSearch(query, filters);
  const providerQueries = getDatasetTopicQueries(intent);
  const includeAll = selected.size === 0;
  const searches: {
    provider: DatasetProviderId;
    promise: ReturnType<typeof collectSearchVariants>;
  }[] = [
    {
      provider: 'UPLOAD',
      promise: collectSearchVariants(
        providerQueries.length ? providerQueries : [query],
        providerQuery =>
          searchStoredDatasets({ query: providerQuery, providers, groupId, userId, limit: 50 })
      ),
    },
  ];
  const shouldSearchExternal = (includeExternal || !groupId) && providerQueries.length > 0;

  if (shouldSearchExternal && (includeAll || selected.has('EUROSTAT'))) {
    searches.push({
      provider: 'EUROSTAT',
      promise: enrichedSourceSearch('EUROSTAT', providerQueries, language, intent, signal),
    });
  }

  if (shouldSearchExternal && (includeAll || selected.has('GOVDATA'))) {
    searches.push({
      provider: 'GOVDATA',
      promise: collectSearchVariants(getGovDataSearchQueries(query, filters), providerQuery =>
        cachedPublicDatasetSearch(
          `govdata:${providerQuery}`,
          inner => searchGovDataCatalogue(providerQuery, 50, inner),
          signal
        ).then(results =>
          results
            .flatMap<DatasetSearchResult>(entry =>
              entry.resources.map(resource => ({
                id: `govdata:${entry.id}:${resource.id}`,
                provider: 'GOVDATA',
                providerDatasetId: entry.id,
                providerResourceId: resource.id,
                title:
                  entry.resources.length > 1 ? `${entry.title} · ${resource.name}` : entry.title,
                description: entry.notes,
                publisher: entry.publisher || entry.organizationTitle,
                modified: resource.modified ?? entry.modified,
                structureSummary: resource.name,
                formatSummary: resource.format || 'CSV',
                byteSize: resource.size,
                timeCoverage: entry.timeCoverage,
                spatialCoverage: entry.spatialCoverage,
                metadata: {
                  packageName: entry.name,
                  resourceName: resource.name,
                  resourceModified: resource.modified,
                },
                entry: { ...entry, resources: [resource] },
              }))
            )
            .slice(0, 50)
        )
      ),
    });
  }

  if (shouldSearchExternal && (includeAll || selected.has('GENESIS_DESTATIS'))) {
    const germanQueries = getDatasetTopicQueries(intent, 'de');
    const englishQueries = getDatasetTopicQueries(intent, 'en');
    // GENESIS matches terms in the requested catalogue language. Its German topic names
    // are narrower and leave room for coverage checks; display metadata keeps the user's language.
    const catalogueLanguage =
      germanQueries[0] !== englishQueries[0] ? 'de' : language === 'de' ? 'de' : 'en';
    searches.push({
      provider: 'GENESIS_DESTATIS',
      promise: enrichedSourceSearch(
        'GENESIS_DESTATIS',
        catalogueLanguage === 'de' ? germanQueries : englishQueries,
        language,
        intent,
        signal,
        catalogueLanguage
      ),
    });
  }

  const settled = await Promise.all(
    searches.map(async search => {
      try {
        return { provider: search.provider, ...(await search.promise) };
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
  return {
    results: rankDatasetSearchResults(results, intent),
    errors: settled.flatMap(result =>
      result.error
        ? [
            {
              provider: result.provider,
              message: result.error,
              ...('code' in result
                ? {
                    code: result.code as import('@/features/charts/types').DatasetProviderError['code'],
                  }
                : {}),
            },
          ]
        : []
    ),
  } satisfies DatasetProviderSearchResponse;
}
