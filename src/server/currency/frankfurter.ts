import {
  currencyCodeSchema,
  isCurrencyCode,
  normalizeCurrencyCode,
  type CurrencyCode,
  type ExchangeRateQuote,
} from '@/features/shared/logic/currency';
import { currencySql as sql } from './db';

const API_BASE_URL = (
  process.env.FRANKFURTER_API_BASE_URL ?? 'https://api.frankfurter.dev'
).replace(/\/$/, '');
const LATEST_KEY = 'latest';
const CURRENT_REFRESH_MS = 6 * 60 * 60 * 1000;
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const CATALOG_REFRESH_MS = 24 * 60 * 60 * 1000;

export interface ServerExchangeRateRequest {
  base: CurrencyCode;
  quote: CurrencyCode;
  date?: string;
}

interface CacheRow {
  base_currency: string;
  quote_currency: string;
  requested_date: string;
  rate_date: string;
  rate: string | number;
  fetched_at: string | Date;
}

interface FrankfurterRateRow {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
}

let catalogCache: { expiresAt: number; currencies: string[] } | null = null;

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function subtractUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function normalizeRequest(request: ServerExchangeRateRequest): ServerExchangeRateRequest {
  return {
    base: currencyCodeSchema.parse(request.base),
    quote: currencyCodeSchema.parse(request.quote),
    ...(request.date ? { date: request.date } : {}),
  };
}

async function fetchJson(url: URL): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return await response.json();
      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt === 1) {
        throw new Error(`Frankfurter returned ${response.status}`);
      }
      lastError = new Error(`Frankfurter returned ${response.status}`);
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw lastError instanceof Error ? lastError : new Error('Frankfurter request failed');
}

async function readCachedRate(request: ServerExchangeRateRequest): Promise<CacheRow | null> {
  const requestedDate = request.date ?? LATEST_KEY;
  const rows = await sql<CacheRow[]>`
    SELECT base_currency, quote_currency, requested_date, rate_date, rate, fetched_at
    FROM currency_exchange_rate_cache
    WHERE base_currency = ${request.base}
      AND quote_currency = ${request.quote}
      AND requested_date = ${requestedDate}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function cacheRowToQuote(row: CacheRow, status: 'cached' | 'stale'): ExchangeRateQuote {
  return {
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    requestedDate: row.requested_date === LATEST_KEY ? null : row.requested_date,
    rateDate: String(row.rate_date).slice(0, 10),
    rate: Number(row.rate),
    source: 'frankfurter',
    cacheStatus: status,
  };
}

async function storeRate(
  request: ServerExchangeRateRequest,
  row: Required<Pick<FrankfurterRateRow, 'date' | 'base' | 'quote' | 'rate'>>
): Promise<ExchangeRateQuote> {
  const requestedDate = request.date ?? LATEST_KEY;
  await sql`
    INSERT INTO currency_exchange_rate_cache (
      base_currency, quote_currency, requested_date, rate_date, rate, source, fetched_at
    ) VALUES (
      ${request.base}, ${request.quote}, ${requestedDate}, ${row.date}, ${row.rate},
      'frankfurter', now()
    )
    ON CONFLICT (base_currency, quote_currency, requested_date)
    DO UPDATE SET rate_date = EXCLUDED.rate_date, rate = EXCLUDED.rate,
      source = EXCLUDED.source, fetched_at = EXCLUDED.fetched_at
  `;
  return {
    baseCurrency: request.base,
    quoteCurrency: request.quote,
    requestedDate: request.date ?? null,
    rateDate: row.date,
    rate: row.rate,
    source: 'frankfurter',
    cacheStatus: 'fresh',
  };
}

function parseRateRows(
  payload: unknown
): Required<Pick<FrankfurterRateRow, 'date' | 'base' | 'quote' | 'rate'>>[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const row = value as FrankfurterRateRow;
    if (
      typeof row.date !== 'string' ||
      typeof row.base !== 'string' ||
      typeof row.quote !== 'string' ||
      typeof row.rate !== 'number' ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0
    ) {
      return [];
    }
    return [{ date: row.date, base: row.base, quote: row.quote, rate: row.rate }];
  });
}

async function fetchRateGroup(
  requests: ServerExchangeRateRequest[]
): Promise<Map<string, Required<Pick<FrankfurterRateRow, 'date' | 'base' | 'quote' | 'rate'>>>> {
  const first = requests[0];
  const quotes = Array.from(new Set(requests.map(request => request.quote)));
  const url = new URL(`${API_BASE_URL}/v2/rates`);
  url.searchParams.set('base', first.base);
  url.searchParams.set('quotes', quotes.join(','));
  if (first.date) url.searchParams.set('date', first.date);
  let rows = parseRateRows(await fetchJson(url));

  const missing = quotes.filter(quote => !rows.some(row => row.quote === quote));
  if (first.date && missing.length > 0) {
    const fallbackUrl = new URL(`${API_BASE_URL}/v2/rates`);
    fallbackUrl.searchParams.set('base', first.base);
    fallbackUrl.searchParams.set('quotes', missing.join(','));
    fallbackUrl.searchParams.set('from', subtractUtcDays(first.date, 10));
    fallbackUrl.searchParams.set('to', first.date);
    rows = rows.concat(parseRateRows(await fetchJson(fallbackUrl)));
  }

  const result = new Map<string, (typeof rows)[number]>();
  for (const row of rows.sort((left, right) => left.date.localeCompare(right.date))) {
    if (!first.date || row.date <= first.date) result.set(row.quote, row);
  }
  return result;
}

export async function getExchangeRates(
  rawRequests: readonly ServerExchangeRateRequest[]
): Promise<ExchangeRateQuote[]> {
  const requests = rawRequests.map(normalizeRequest);
  const results = new Map<string, ExchangeRateQuote>();
  const misses: ServerExchangeRateRequest[] = [];
  const keyOf = (request: ServerExchangeRateRequest) =>
    `${request.base}:${request.quote}:${request.date ?? LATEST_KEY}`;

  for (const request of requests) {
    if (request.base === request.quote) {
      results.set(keyOf(request), {
        baseCurrency: request.base,
        quoteCurrency: request.quote,
        requestedDate: request.date ?? null,
        rateDate: request.date ?? new Date().toISOString().slice(0, 10),
        rate: 1,
        source: 'frankfurter',
        cacheStatus: 'identity',
      });
      continue;
    }
    const cached = await readCachedRate(request);
    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (request.date || age <= CURRENT_REFRESH_MS) {
        results.set(keyOf(request), cacheRowToQuote(cached, 'cached'));
        continue;
      }
    }
    misses.push(request);
  }

  const groups = new Map<string, ServerExchangeRateRequest[]>();
  for (const request of misses) {
    const groupKey = `${request.base}:${request.date ?? LATEST_KEY}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), request]);
  }

  for (const group of groups.values()) {
    try {
      const fetched = await fetchRateGroup(group);
      for (const request of group) {
        const row = fetched.get(request.quote);
        if (row) {
          results.set(keyOf(request), await storeRate(request, row));
          continue;
        }
        const cached = await readCachedRate(request);
        if (!cached) continue;
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (request.date || age <= MAX_STALE_MS) {
          results.set(keyOf(request), cacheRowToQuote(cached, 'stale'));
        }
      }
    } catch (error) {
      console.error('Frankfurter rate fetch failed:', error);
      for (const request of group) {
        const cached = await readCachedRate(request);
        if (!cached) continue;
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (request.date || age <= MAX_STALE_MS) {
          results.set(keyOf(request), cacheRowToQuote(cached, 'stale'));
        }
      }
    }
  }

  return requests.flatMap(request => {
    const rate = results.get(keyOf(request));
    return rate ? [rate] : [];
  });
}

export async function getFrankfurterCurrencies(): Promise<string[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.currencies;
  const payload = await fetchJson(new URL(`${API_BASE_URL}/v2/currencies`));
  const currencies = Array.isArray(payload)
    ? payload
        .map(value =>
          value && typeof value === 'object' && 'iso_code' in value
            ? normalizeCurrencyCode(String(value.iso_code))
            : ''
        )
        .filter(isCurrencyCode)
        .sort()
    : [];
  if (currencies.length === 0) throw new Error('Frankfurter returned no supported currencies');
  catalogCache = { expiresAt: Date.now() + CATALOG_REFRESH_MS, currencies };
  return currencies;
}

export function validateExchangeRateDate(date?: string): string | undefined {
  if (date === undefined) return undefined;
  if (!isIsoDate(date)) throw new Error('Invalid exchange-rate date');
  return date;
}
