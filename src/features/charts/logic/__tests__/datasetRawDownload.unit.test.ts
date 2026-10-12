import { expect, it } from 'vitest';
import { encodeAppError } from '@/features/shared/errors/app-error';
import { canRecoverDatasetFile, datasetRawDownloadTarget } from '../datasetRawDownload';
it('offers recovery for processing and size failures, but not permission, validation or aborted requests', () => {
  for (const code of [
    'dataset_provider_invalid_response',
    'dataset_scope_too_large',
    'upload_failed',
  ] as const)
    expect(canRecoverDatasetFile(encodeAppError(code))).toBe(true);
  for (const code of [
    'permission_denied',
    'validation_failed',
    'dataset_scope_unavailable',
  ] as const)
    expect(canRecoverDatasetFile(encodeAppError(code))).toBe(false);
  expect(canRecoverDatasetFile(new DOMException('Aborted', 'AbortError'))).toBe(false);
});
it('retains exact dataset/resource/snapshot identity without any import or table filters', () => {
  const target = datasetRawDownloadTarget(null, {
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: '13211-0002',
    filters: { area: 'Deutschland' },
    rowFilters: { metric: 'rate' },
    timeRange: { column: 'period', startYear: 2025, endYear: 2025 },
  });
  expect(target?.request).toEqual({
    provider: 'GENESIS_DESTATIS',
    providerDatasetId: '13211-0002',
    providerResourceId: undefined,
    language: 'en',
  });
  expect(datasetRawDownloadTarget(null, { provider: 'UPLOAD' })).toBeUndefined();
  expect(
    datasetRawDownloadTarget(null, { provider: 'GOVDATA', providerDatasetId: 'package' })
  ).toBeUndefined();
  expect(
    datasetRawDownloadTarget(null, {
      provider: 'UPLOAD',
      snapshotId: 'snapshot',
      datasetId: 'dataset',
    })?.request
  ).toMatchObject({ snapshotId: 'snapshot', datasetId: 'dataset' });
});
