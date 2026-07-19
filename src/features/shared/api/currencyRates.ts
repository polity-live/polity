import {
  convertCurrency,
  type CurrencyCode,
  type CurrencyConversionResult,
  type ExchangeRateQuote,
} from '@/features/shared/logic/currency';

export interface ExchangeRateRequest {
  base: CurrencyCode;
  quote: CurrencyCode;
  date?: string;
}

interface QueuedRateRequest {
  request: ExchangeRateRequest;
  resolve: (rate: ExchangeRateQuote | null) => void;
  reject: (error: unknown) => void;
}

const rateCache = new Map<string, { rate: ExchangeRateQuote; expiresAt: number }>();
let queuedRates: QueuedRateRequest[] = [];
let rateFlushScheduled = false;

function rateKey(request: ExchangeRateRequest | ExchangeRateQuote) {
  const isRequest = 'base' in request;
  const base = isRequest ? request.base : request.baseCurrency;
  const quote = isRequest ? request.quote : request.quoteCurrency;
  const date = isRequest ? request.date : request.requestedDate;
  return `${base}:${quote}:${date ?? 'latest'}`;
}

async function flushQueuedRates() {
  rateFlushScheduled = false;
  const queue = queuedRates;
  queuedRates = [];
  const unique = [...new Map(queue.map(item => [rateKey(item.request), item.request])).values()];

  try {
    const rates = await fetchExchangeRates(unique);
    const byKey = new Map(rates.map(rate => [rateKey(rate), rate]));
    const now = Date.now();
    for (const rate of rates) {
      rateCache.set(rateKey(rate), {
        rate,
        expiresAt: now + (rate.requestedDate ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000),
      });
    }
    for (const item of queue) item.resolve(byKey.get(rateKey(item.request)) ?? null);
  } catch (error) {
    for (const item of queue) item.reject(error);
  }
}

/** Coalesces rate lookups issued in the same render turn into one request. */
export function getExchangeRate(request: ExchangeRateRequest): Promise<ExchangeRateQuote | null> {
  const key = rateKey(request);
  const cached = rateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.rate);

  return new Promise((resolve, reject) => {
    queuedRates.push({ request, resolve, reject });
    if (!rateFlushScheduled) {
      rateFlushScheduled = true;
      queueMicrotask(() => void flushQueuedRates());
    }
  });
}

export async function fetchExchangeRates(
  requests: readonly ExchangeRateRequest[],
  signal?: AbortSignal
): Promise<ExchangeRateQuote[]> {
  if (requests.length === 0) return [];
  const response = await fetch('/api/currency/rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
    signal,
  });
  if (!response.ok) throw new Error('Currency conversion is unavailable');
  const payload = (await response.json()) as { rates?: ExchangeRateQuote[] };
  return payload.rates ?? [];
}

export async function convertCurrencyAmount(args: {
  amount: number;
  base: CurrencyCode;
  quote: CurrencyCode;
  date?: string;
  signal?: AbortSignal;
}): Promise<CurrencyConversionResult | null> {
  if (args.signal?.aborted) return null;
  const rate = await getExchangeRate({ base: args.base, quote: args.quote, date: args.date });
  if (args.signal?.aborted) return null;
  return rate ? convertCurrency(args.amount, rate) : null;
}
