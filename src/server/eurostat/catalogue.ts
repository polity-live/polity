import { parse } from 'csv-parse/sync';
import type { EurostatCatalogueEntry } from '@/features/charts/types';
import { CATALOGUE_CACHE_MS, EUROSTAT_BASE_URL } from './constants';

interface CatalogueCacheEntry {
  expiresAt: number;
  entries: EurostatCatalogueEntry[];
}

const cache = new Map<string, CatalogueCacheEntry>();

function normalizeLanguage(language: string) {
  return ['en', 'de', 'fr'].includes(language) ? language : 'en';
}

function nullableText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

export async function getEurostatCatalogue(language = 'en') {
  const normalizedLanguage = normalizeLanguage(language);
  const cached = cache.get(normalizedLanguage);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.entries;
  }

  const response = await fetch(`${EUROSTAT_BASE_URL}/catalogue/toc/txt?lang=${normalizedLanguage}`);
  if (!response.ok) {
    throw new Error(`Eurostat catalogue request failed with ${response.status}`);
  }

  const records = parse(await response.text(), {
    columns: true,
    delimiter: '\t',
    relax_column_count: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const entries = records
    .filter(record => record.type === 'dataset' || record.type === 'table')
    .map<EurostatCatalogueEntry>(record => ({
      code: String(record.code ?? '')
        .trim()
        .toUpperCase(),
      title: String(record.title ?? '').trim(),
      type: String(record.type).trim(),
      lastUpdate: nullableText(record['last update of data']),
      structureLastChange: nullableText(record['last table structure change']),
      dataStart: nullableText(record['data start']),
      dataEnd: nullableText(record['data end']),
      valueCount: Number(record.values ?? 0) || 0,
    }))
    .filter(entry => entry.code && entry.title);

  const deduplicated = [...new Map(entries.map(entry => [entry.code, entry])).values()];
  cache.set(normalizedLanguage, {
    entries: deduplicated,
    expiresAt: Date.now() + CATALOGUE_CACHE_MS,
  });
  return deduplicated;
}

export async function searchEurostatCatalogue(query: string, language = 'en', limit = 20) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const entries = await getEurostatCatalogue(language);
  return entries
    .map(entry => {
      const code = entry.code.toLocaleLowerCase();
      const title = entry.title.toLocaleLowerCase();
      const score =
        code === normalizedQuery
          ? 0
          : code.startsWith(normalizedQuery)
            ? 1
            : title.startsWith(normalizedQuery)
              ? 2
              : code.includes(normalizedQuery)
                ? 3
                : title.includes(normalizedQuery)
                  ? 4
                  : 99;
      return { entry, score };
    })
    .filter(result => result.score < 99)
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.entry.valueCount - left.entry.valueCount ||
        left.entry.title.localeCompare(right.entry.title)
    )
    .slice(0, limit)
    .map(result => result.entry);
}

export async function findEurostatCatalogueEntry(code: string, language = 'en') {
  const normalizedCode = code.trim().toUpperCase();
  const entry = (await getEurostatCatalogue(language)).find(item => item.code === normalizedCode);
  if (!entry) {
    throw new Error(`Eurostat dataset ${normalizedCode} was not found`);
  }
  return entry;
}
