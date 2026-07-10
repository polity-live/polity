import { createHash } from 'node:crypto';
import { MAX_DATASET_SNAPSHOT_BYTES } from '@/features/charts/types';
import { createClient } from '@/lib/supabase/server';

export const DATASET_SNAPSHOT_BUCKET = 'dataset-snapshots';

export function assertDatasetSize(byteSize: number, label = 'Dataset snapshot') {
  if (byteSize > MAX_DATASET_SNAPSHOT_BYTES) {
    throw new Error(`${label} exceeds the 50 MiB snapshot limit`);
  }
}

export async function readLimitedResponseBytes(response: Response, label = 'Dataset download') {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength)) {
    assertDatasetSize(contentLength, label);
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertDatasetSize(bytes.byteLength, label);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_DATASET_SNAPSHOT_BYTES) {
      void reader.cancel().catch(() => undefined);
      assertDatasetSize(totalBytes, label);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function bytesToText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

export function textToBytes(text: string) {
  return new TextEncoder().encode(text);
}

export function hashBytes(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function createSnapshotStoragePath(
  datasetId: string,
  snapshotId: string,
  extension = 'csv'
) {
  return `${datasetId}/${snapshotId}.${extension}`;
}

export async function uploadSnapshotBytes(
  path: string,
  bytes: Uint8Array,
  contentType = 'text/csv'
) {
  assertDatasetSize(bytes.byteLength);

  const supabase = createClient();
  const { error } = await supabase.storage.from(DATASET_SNAPSHOT_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function downloadSnapshotText(path: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(DATASET_SNAPSHOT_BUCKET).download(path);
  if (error) {
    throw new Error(error.message);
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  assertDatasetSize(bytes.byteLength);
  return bytesToText(bytes);
}

export async function removeSnapshotObject(path: string) {
  const supabase = createClient();
  const { error } = await supabase.storage.from(DATASET_SNAPSHOT_BUCKET).remove([path]);
  if (error) {
    throw new Error(error.message);
  }
}
