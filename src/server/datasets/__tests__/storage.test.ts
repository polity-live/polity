import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_DATASET_SNAPSHOT_BYTES } from '@/features/charts/types';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import {
  assertDatasetSize,
  bytesToText,
  createSnapshotStoragePath,
  DATASET_SNAPSHOT_BUCKET,
  downloadSnapshotText,
  hashBytes,
  readLimitedResponseBytes,
  removeSnapshotObject,
  textToBytes,
  uploadSnapshotBytes,
} from '../storage';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({
    upload: mocks.upload,
    download: mocks.download,
    remove: mocks.remove,
  });
  mocks.createClient.mockReturnValue({ storage: { from: mocks.from } });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.download.mockResolvedValue({
    data: { arrayBuffer: vi.fn().mockResolvedValue(textToBytes('stored').buffer) },
    error: null,
  });
  mocks.remove.mockResolvedValue({ error: null });
});

describe('dataset storage limits', () => {
  it('accepts the exact maximum and rejects larger default and custom-labelled payloads', () => {
    expect(() => assertDatasetSize(MAX_DATASET_SNAPSHOT_BYTES)).not.toThrow();
    expect(() => assertDatasetSize(MAX_DATASET_SNAPSHOT_BYTES + 1)).toThrow(
      'Dataset snapshot exceeds the 50 MiB snapshot limit'
    );
    expect(() => assertDatasetSize(MAX_DATASET_SNAPSHOT_BYTES + 1, 'Import')).toThrow(
      'Import exceeds the 50 MiB snapshot limit'
    );
  });

  it('rejects an oversized declared content length before reading', async () => {
    const response = {
      headers: { get: vi.fn().mockReturnValue(String(MAX_DATASET_SNAPSHOT_BYTES + 1)) },
    } as unknown as Response;
    await expect(readLimitedResponseBytes(response)).rejects.toThrow(
      'Dataset download exceeds the 50 MiB snapshot limit'
    );
  });

  it('falls back to arrayBuffer when no body is exposed', async () => {
    const response = {
      headers: { get: vi.fn().mockReturnValue('not-a-number') },
      body: null,
      arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
    } as unknown as Response;
    await expect(readLimitedResponseBytes(response, 'Fallback')).resolves.toEqual(
      Uint8Array.from([1, 2, 3])
    );
  });

  it('joins streamed chunks and ignores empty reader values', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: undefined })
      .mockResolvedValueOnce({ done: false, value: Uint8Array.from([1, 2]) })
      .mockResolvedValueOnce({ done: false, value: Uint8Array.from([3]) })
      .mockResolvedValueOnce({ done: true, value: undefined });
    const response = {
      headers: { get: vi.fn().mockReturnValue('3') },
      body: { getReader: () => ({ read, cancel: vi.fn() }) },
    } as unknown as Response;
    await expect(readLimitedResponseBytes(response)).resolves.toEqual(Uint8Array.from([1, 2, 3]));
  });

  it('cancels a stream that crosses the limit and tolerates cancellation failure', async () => {
    const oversizedValue = { byteLength: MAX_DATASET_SNAPSHOT_BYTES + 1 };
    const cancel = vi.fn().mockRejectedValue(new Error('already closed'));
    const response = {
      headers: { get: vi.fn().mockReturnValue('unknown') },
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: false, value: oversizedValue }),
          cancel,
        }),
      },
    } as unknown as Response;
    await expect(readLimitedResponseBytes(response, 'Stream')).rejects.toThrow(
      'Stream exceeds the 50 MiB snapshot limit'
    );
    expect(cancel).toHaveBeenCalledOnce();
    await Promise.resolve();
  });
});

describe('dataset storage utilities and Supabase boundary', () => {
  it('converts, hashes and builds default and explicit storage paths', () => {
    const bytes = textToBytes('hello');
    expect(bytesToText(bytes)).toBe('hello');
    expect(hashBytes(bytes)).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
    expect(createSnapshotStoragePath('dataset', 'snapshot')).toBe('dataset/snapshot.csv');
    expect(createSnapshotStoragePath('dataset', 'snapshot', 'json')).toBe('dataset/snapshot.json');
  });

  it('uploads with default and explicit content types and reports storage errors', async () => {
    const bytes = textToBytes('value');
    await uploadSnapshotBytes('one.csv', bytes);
    expect(mocks.from).toHaveBeenCalledWith(DATASET_SNAPSHOT_BUCKET);
    expect(mocks.upload).toHaveBeenCalledWith('one.csv', bytes, {
      contentType: 'text/csv',
      upsert: true,
    });

    mocks.upload.mockResolvedValueOnce({ error: { message: 'upload failed' } });
    await expect(uploadSnapshotBytes('two.json', bytes, 'application/json')).rejects.toThrow(
      'upload failed'
    );
  });

  it('downloads text and reports download errors', async () => {
    await expect(downloadSnapshotText('one.csv')).resolves.toBe('stored');
    expect(mocks.download).toHaveBeenCalledWith('one.csv');

    mocks.download.mockResolvedValueOnce({ data: null, error: { message: 'download failed' } });
    await expect(downloadSnapshotText('missing.csv')).rejects.toThrow('download failed');
  });

  it('removes objects and reports removal errors', async () => {
    await expect(removeSnapshotObject('one.csv')).resolves.toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith(['one.csv']);

    mocks.remove.mockResolvedValueOnce({ error: { message: 'remove failed' } });
    await expect(removeSnapshotObject('one.csv')).rejects.toThrow('remove failed');
  });
});
