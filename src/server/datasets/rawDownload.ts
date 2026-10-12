import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type {
  DatasetRawDownloadPreparation,
  DatasetRawDownloadRequest,
} from '@/features/charts/types';
import { createClient } from '@/lib/supabase/server';
import { loadGovDataPackage } from '@/server/govdata/catalogue';
import { assertSafePublicHttpUrl } from '@/server/govdata/safety';
import { createEurostatDataUrl } from '@/server/eurostat/metadata';
import { loadRawSnapshotRecord } from './service';
import { getGenesisTableMetadata } from './genesis';
import { datasetYear } from './importScope';
import { assertGenesisStatus, postGenesisStream } from './genesisTransport';
import { DatasetProviderFailure } from './providerError';
import { rawResponseStream } from './rawStream';

export const rawDownloadRequestSchema = z
  .object({
    provider: z.enum(['GOVDATA', 'EUROSTAT', 'GENESIS_DESTATIS', 'UPLOAD']),
    providerDatasetId: z.string().trim().min(1).max(200).nullable().optional(),
    providerResourceId: z.string().trim().min(1).max(200).nullable().optional(),
    datasetId: z.string().uuid().nullable().optional(),
    snapshotId: z.string().uuid().nullable().optional(),
    language: z.enum(['de', 'en', 'fr']).default('en'),
  })
  .strict();
const ticketSchema = z
  .object({
    purpose: z.literal('dataset-raw-download-v1'),
    actor: z.string().uuid(),
    expires: z.number().int(),
    selection: rawDownloadRequestSchema,
    fileName: z.string().min(1).max(200),
    sourceUrl: z.string().url().nullable(),
  })
  .strict();
export type RawDownloadTicket = z.infer<typeof ticketSchema>;
export class RawDownloadDenied extends Error {}

function signingKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new DatasetProviderFailure('Download signing is unavailable', 'authentication', 503);
  return key;
}
export function signRawDownloadTicket(ticket: RawDownloadTicket) {
  const encoded = Buffer.from(JSON.stringify(ticketSchema.parse(ticket))).toString('base64url');
  return `${encoded}.${createHmac('sha256', signingKey()).update(encoded).digest('base64url')}`;
}
export function verifyRawDownloadTicket(value: string, now = Date.now()) {
  if (!value || value.length > 12_000) throw new RawDownloadDenied('Invalid download ticket');
  const [encoded, signature, extra] = value.split('.');
  if (
    !encoded ||
    !signature ||
    extra ||
    !/^[A-Za-z0-9_-]+$/.test(encoded) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  )
    throw new RawDownloadDenied('Invalid download ticket');
  const expected = createHmac('sha256', signingKey()).update(encoded).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new RawDownloadDenied('Invalid download ticket');
  let ticket: RawDownloadTicket;
  try {
    ticket = ticketSchema.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
  } catch {
    throw new RawDownloadDenied('Invalid download ticket');
  }
  if (ticket.expires <= now || ticket.expires > now + 5 * 60_000)
    throw new RawDownloadDenied('Expired download ticket');
  return ticket;
}

function safeFileName(value: string) {
  const cleaned = Array.from(value)
    .map(character => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127 ? '_' : character;
    })
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180);
  return cleaned || 'dataset.csv';
}
async function resolveSelection(
  input: DatasetRawDownloadRequest,
  actor: string,
  signal?: AbortSignal
) {
  let selection = rawDownloadRequestSchema.parse(input);
  let snapshot: Awaited<ReturnType<typeof loadRawSnapshotRecord>> | undefined;
  if (selection.snapshotId) {
    try {
      snapshot = await loadRawSnapshotRecord(selection.snapshotId, actor);
    } catch {
      throw new RawDownloadDenied('Snapshot access denied');
    }
    const dataset = snapshot.dataset;
    if (
      selection.provider !== dataset.provider ||
      (selection.datasetId && selection.datasetId !== dataset.id) ||
      (selection.providerDatasetId &&
        selection.providerDatasetId !== dataset.provider_dataset_id) ||
      (selection.providerResourceId &&
        selection.providerResourceId !== dataset.provider_resource_id)
    )
      throw new RawDownloadDenied('Snapshot identity mismatch');
    selection = {
      ...selection,
      datasetId: dataset.id,
      providerDatasetId: dataset.provider_dataset_id,
      providerResourceId: dataset.provider_resource_id,
    };
  } else if (selection.datasetId) {
    // Private dataset requests must carry their exact snapshot, rather than bypassing access checks.
    throw new RawDownloadDenied('Snapshot identity required');
  }
  if (selection.provider === 'UPLOAD') {
    if (!snapshot) throw new RawDownloadDenied('Snapshot identity required');
    return {
      selection,
      snapshot,
      fileName: safeFileName(`${snapshot.dataset.title}-snapshot.csv`),
      sourceUrl: null,
    };
  }
  const code = selection.providerDatasetId;
  if (!code) throw new DatasetProviderFailure('Dataset code is required', 'invalid_scope', 422);
  if (selection.provider === 'GOVDATA') {
    if (!selection.providerResourceId)
      throw new DatasetProviderFailure('Resource identity is required', 'invalid_scope', 422);
    const pkg = await loadGovDataPackage(code, signal);
    const resource = pkg.resources?.find(item => item.id === selection.providerResourceId);
    if (!resource) throw new DatasetProviderFailure('Resource is unavailable', 'unavailable', 404);
    const url = assertSafePublicHttpUrl(
      String(resource.download_url || resource.url || resource.access_url)
    );
    let name: string;
    try {
      name = decodeURIComponent(url.pathname.split('/').at(-1) || 'dataset.csv');
    } catch {
      name = 'dataset.csv';
    }
    return { selection, fileName: safeFileName(name), sourceUrl: url.toString(), snapshot };
  }
  if (selection.provider === 'GENESIS_DESTATIS') {
    if (!/^\d{5}-\d{4}$/.test(code))
      throw new DatasetProviderFailure('Invalid table code', 'invalid_scope', 422);
    return {
      selection,
      fileName: `${code}.csv`,
      sourceUrl: `https://www-genesis.destatis.de/genesis/online?operation=table&code=${encodeURIComponent(code)}`,
      snapshot,
    };
  }
  return {
    selection,
    fileName: safeFileName(`${code}.csv`),
    sourceUrl: `https://ec.europa.eu/eurostat/databrowser/view/${encodeURIComponent(code)}/default/table`,
    snapshot,
  };
}

export async function prepareRawDownload(
  input: DatasetRawDownloadRequest,
  actor: string,
  signal?: AbortSignal
): Promise<DatasetRawDownloadPreparation> {
  const resolved = await resolveSelection(input, actor, signal);
  signal?.throwIfAborted();
  const ticket = signRawDownloadTicket({
    purpose: 'dataset-raw-download-v1',
    actor,
    expires: Date.now() + 5 * 60_000,
    selection: resolved.selection,
    fileName: resolved.fileName,
    sourceUrl: resolved.sourceUrl,
  });
  return {
    url: `/api/datasets/raw-download?ticket=${encodeURIComponent(ticket)}`,
    fileName: resolved.fileName,
    kind: resolved.selection.provider === 'UPLOAD' ? 'snapshot' : 'provider',
    fullDataset: resolved.selection.provider !== 'UPLOAD',
  };
}

/** Only registry-resolved public resources are fetched. Every redirect is checked before following. */
async function fetchRawFile(
  url: URL,
  requestSignal: AbortSignal,
  headers?: HeadersInit,
  trustedStorage = false
) {
  const controller = new AbortController();
  const signal = AbortSignal.any([requestSignal, controller.signal]);
  const timer = setTimeout(
    () =>
      controller.abort(new DatasetProviderFailure('Download connection timed out', 'timeout', 504)),
    120_000
  );
  try {
    let current = url;
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (!trustedStorage) assertSafePublicHttpUrl(current.toString());
      const response = await fetch(current, { signal, redirect: 'manual', headers });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || trustedStorage)
          throw new DatasetProviderFailure('Invalid source redirect', 'invalid_response');
        current = assertSafePublicHttpUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new DatasetProviderFailure('File download is unavailable', 'unavailable');
      }
      clearTimeout(timer);
      return new Response(
        rawResponseStream(response, { signal, onAbort: () => controller.abort() }),
        { headers: response.headers }
      );
    }
    throw new DatasetProviderFailure('Too many source redirects', 'invalid_response');
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof DatasetProviderFailure) throw error;
    throw new DatasetProviderFailure('Source connection failed', 'unavailable');
  } finally {
    clearTimeout(timer);
  }
}

export async function streamRawDownload(ticket: RawDownloadTicket, signal: AbortSignal) {
  // Recheck private rights and registry identity at transfer time; no parser or readiness test.
  const resolved = await resolveSelection(ticket.selection, ticket.actor, signal);
  let response: Response;
  if (resolved.selection.provider === 'UPLOAD') {
    const snapshot = resolved.snapshot;
    if (!snapshot) throw new RawDownloadDenied('Snapshot identity required');
    const { data, error } = await createClient()
      .storage.from(snapshot.storage_bucket)
      .createSignedUrl(snapshot.storage_path, 60);
    if (error || !data?.signedUrl)
      throw new DatasetProviderFailure('Stored file is unavailable', 'unavailable');
    response = await fetchRawFile(new URL(data.signedUrl), signal, undefined, true);
  } else if (resolved.selection.provider === 'GENESIS_DESTATIS') {
    const started = Date.now();
    const language = resolved.selection.language === 'de' ? 'de' : 'en';
    const entry = await getGenesisTableMetadata(
      resolved.selection.providerDatasetId ?? '',
      language,
      AbortSignal.any([signal, AbortSignal.timeout(120_000)])
    );
    const start = datasetYear(String(entry.Time?.From ?? ''));
    const end = datasetYear(String(entry.Time?.To ?? ''));
    if (start === null || end === null || start > end)
      throw new DatasetProviderFailure(
        'Full dataset coverage cannot be confirmed',
        'invalid_response'
      );
    // GENESIS otherwise silently defaults to its latest two years. These are full provider bounds,
    // never user search/import filters; all regional keys and contents remain unspecified.
    response = await postGenesisStream(
      'data/tablefile',
      {
        name: resolved.selection.providerDatasetId ?? '',
        area: 'free',
        format: 'ffcsv',
        compress: false,
        language,
        startyear: String(start),
        endyear: String(end),
      },
      { signal, timeoutMs: Math.max(1, 120_000 - (Date.now() - started)) }
    );
  } else if (resolved.selection.provider === 'EUROSTAT') {
    const url = createEurostatDataUrl(resolved.selection.providerDatasetId ?? '', {});
    url.searchParams.set('format', 'csvdata');
    url.searchParams.set('formatVersion', '2.0');
    url.searchParams.set('compressed', 'true');
    response = await fetchRawFile(url, signal, {
      Accept: 'application/vnd.sdmx.data+csv;version=2.0.0',
    });
  } else {
    if (!resolved.sourceUrl)
      throw new DatasetProviderFailure('Source file is unavailable', 'unavailable');
    response = await fetchRawFile(new URL(resolved.sourceUrl), signal);
  }

  if (!response.body)
    throw new DatasetProviderFailure('Source returned no file', 'invalid_response');
  const reader = response.body.getReader();
  const initialChunks: Uint8Array[] = [];
  let prefixSize = 0;
  while (prefixSize < 64) {
    const first = await reader.read();
    if (first.done) break;
    if (first.value.length) {
      initialChunks.push(first.value);
      prefixSize += first.value.length;
    }
  }
  if (!prefixSize) {
    await reader.cancel();
    throw new DatasetProviderFailure('The source returned an empty file', 'invalid_response');
  }
  let remainingProbe = 4096;
  const prefix = Buffer.concat(
    initialChunks.map(chunk => {
      const value = chunk.subarray(0, Math.max(0, remainingProbe));
      remainingProbe -= value.length;
      return value;
    })
  );
  const probe = new TextDecoder()
    .decode(prefix)
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (
    ['GENESIS_DESTATIS', 'EUROSTAT'].includes(resolved.selection.provider) &&
    (probe.startsWith('{') ||
      probe.startsWith('<') ||
      /json|xml|text\/html/i.test(response.headers.get('content-type') ?? ''))
  ) {
    // Control envelopes are never downloaded as data. Do not include echoed credentials in errors.
    const chunks = [...initialChunks];
    let count = prefixSize;
    try {
      while (count <= 256 * 1024) {
        const next = await reader.read();
        if (next.done) break;
        chunks.push(next.value);
        count += next.value.byteLength;
      }
      if (
        resolved.selection.provider === 'GENESIS_DESTATIS' &&
        count <= 256 * 1024 &&
        probe.startsWith('{')
      ) {
        let envelope: unknown;
        try {
          envelope = JSON.parse(
            Buffer.concat(chunks)
              .toString('utf8')
              .replace(/^\uFEFF/, '')
              .trimStart()
          );
        } catch {
          throw new DatasetProviderFailure('Invalid provider status response', 'invalid_response');
        }
        assertGenesisStatus(envelope, true);
      }
      throw new DatasetProviderFailure(
        'The provider did not return a downloadable file',
        'invalid_response'
      );
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
  const zip = prefix[0] === 0x50 && prefix[1] === 0x4b;
  const gzip = prefix[0] === 0x1f && prefix[1] === 0x8b;
  let fileName = resolved.fileName;
  if (zip && !/\.zip$/i.test(fileName)) fileName += '.zip';
  if (gzip && !/\.gz$/i.test(fileName)) fileName += '.gz';
  let initial = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (initial < initialChunks.length) {
          controller.enqueue(initialChunks[initial++]);
          return;
        }
        const next = await reader.read();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
        await reader.cancel().catch(() => undefined);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
  // fetch may transparently decode HTTP content-encoding. Do not forward stale encoding/length headers.
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return new Response(body, {
    headers: {
      'Content-Type': gzip
        ? 'application/gzip'
        : zip
          ? 'application/zip'
          : 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
