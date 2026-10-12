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

it('requires a provider and preserves snapshot identity and supported languages from selected results', () => {
  expect(datasetRawDownloadTarget()).toBeUndefined();
  const result = {
    id: 'dataset',
    provider: 'UPLOAD' as const,
    snapshotId: 'snapshot',
    sourceUrl: 'https://source.example/data.csv',
  } as Parameters<typeof datasetRawDownloadTarget>[0];
  expect(datasetRawDownloadTarget(result, null, 'fr')).toEqual({
    request: {
      provider: 'UPLOAD',
      providerDatasetId: undefined,
      providerResourceId: undefined,
      snapshotId: 'snapshot',
      datasetId: 'dataset',
      language: 'fr',
    },
    sourceUrl: 'https://source.example/data.csv',
  });
  for (const language of ['de', 'en', 'fr']) {
    expect(
      datasetRawDownloadTarget(null, { provider: 'EUROSTAT', providerDatasetId: 'demo', language })
        ?.request?.language
    ).toBe(language);
  }
  expect(canRecoverDatasetFile(undefined)).toBe(true);
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
