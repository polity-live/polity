import type { DatasetSearchResult } from '@/features/charts/types';
import { parseDatasetCsv } from './csv';
import { persistDatasetSnapshot } from './service';
import { bytesToText, readLimitedResponseBytes } from './storage';
import { unzipFirstTextFile } from './zip';

const DEFAULT_GENESIS_BASE_URL = 'https://genesis.destatis.de/genesisWS/rest/2020/';

function getGenesisBaseUrl() {
  return (process.env.GENESIS_BASE_URL || DEFAULT_GENESIS_BASE_URL).replace(/\/?$/, '/');
}

function getGenesisHeaders() {
  const token = process.env.GENESIS_API_TOKEN;
  if (!token) {
    throw new Error('GENESIS_API_TOKEN is not configured');
  }

  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    username: token,
    password: '',
  };
}

async function postGenesis(path: string, data: Record<string, string | number | boolean>) {
  const response = await fetch(`${getGenesisBaseUrl()}${path}`, {
    method: 'POST',
    headers: getGenesisHeaders(),
    body: new URLSearchParams(
      Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]))
    ),
  });
  if (!response.ok) {
    throw new Error(`GENESIS request failed with ${response.status}`);
  }
  return response;
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized ? normalized : null;
}

function listFromGenesisBody(value: unknown) {
  const body = value as { List?: unknown };
  return Array.isArray(body?.List) ? (body.List as Record<string, unknown>[]) : [];
}

export async function searchGenesisDatasets(query: string, language = 'de', limit = 20) {
  const term = query.trim();
  if (term.length < 2) return [];

  const response = await postGenesis('find/find', {
    term,
    category: 'all',
    pagelength: Math.max(limit, 20),
    language,
  });
  const body = await response.json();

  return listFromGenesisBody(body)
    .map<DatasetSearchResult | null>(entry => {
      const code = nullableText(entry.Code ?? entry.Name ?? entry.name);
      const title = nullableText(entry.Content ?? entry.Title ?? entry.title);
      if (!code || !title) return null;

      return {
        id: `genesis:${code}`,
        provider: 'GENESIS_DESTATIS',
        providerDatasetId: code,
        title,
        description: nullableText(entry.Information ?? entry.Description),
        publisher: 'Statistisches Bundesamt (Destatis)',
        sourceUrl: 'https://www-genesis.destatis.de/genesis/online',
        modified: nullableText(entry.LatestUpdate ?? entry.Date),
        structureSummary: nullableText(entry.Time ?? entry.State ?? entry.Type),
        formatSummary: 'FFCSV',
        valueSummary: nullableText(entry.State),
        metadata: entry,
        entry,
      };
    })
    .filter((entry): entry is DatasetSearchResult => Boolean(entry))
    .slice(0, limit);
}

export async function importGenesisDatasetSnapshot({
  code,
  language = 'de',
  userId,
}: {
  code: string;
  language?: string;
  userId: string;
}) {
  const normalizedCode = code.trim();
  if (!normalizedCode) throw new Error('GENESIS dataset code is required');

  const response = await postGenesis('data/tablefile', {
    name: normalizedCode,
    format: 'ffcsv',
    compress: 'true',
    language,
  });
  const bytes = await readLimitedResponseBytes(response, 'GENESIS dataset');
  const contentType = response.headers.get('content-type') ?? '';
  const text =
    contentType.includes('zip') || bytes[0] === 0x50
      ? unzipFirstTextFile(bytes)
      : bytesToText(bytes);
  if (text.trim().startsWith('{')) {
    const status = JSON.parse(text) as { Status?: { Code?: number; Content?: string } };
    throw new Error(status.Status?.Content || 'GENESIS dataset could not be downloaded');
  }

  const table = parseDatasetCsv(text);
  const searchResult = (await searchGenesisDatasets(normalizedCode, language, 1))[0];
  return persistDatasetSnapshot({
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: normalizedCode,
    title: searchResult?.title ?? normalizedCode,
    description: searchResult?.description,
    publisher: 'Statistisches Bundesamt (Destatis)',
    sourceUrl: searchResult?.sourceUrl,
    structureSummary: searchResult?.structureSummary,
    metadata: {
      ...(searchResult?.metadata ?? {}),
      source: 'GENESIS/Destatis',
    },
    createdById: userId,
    table,
  });
}
